// POST /api/chat
//
//   { model, messages: [{ role, text, images: [{ mime, data(base64) }] }], system?, temperature? }
//     -> streams newline-delimited JSON events:
//        {"type":"start"} {"type":"delta","text":"..."} {"type":"finish","reason":"STOP"} {"type":"error","message":"..."}
//
//   { action: "title", text, reply? }
//     -> { title }   (short chat title, uses a cheap model)

import { HttpError, json, errorResponse } from '../lib/http.mjs';
import { callGemini, GeminiError } from '../lib/gemini.mjs';
import { buildChatRequest, readJsonBody } from '../lib/request.mjs';
import { hasAccess, checkRate, clientIp } from '../lib/guard.mjs';
import { getTitleModel, smartTitlesEnabled } from '../lib/config.mjs';
import { ownerReply } from '../lib/owner.mjs';

export const config = { path: '/api/chat' };

const BLOCK_MESSAGE = "This request was blocked by Dragon's safety filters. Try rephrasing it.";

export default async (req, context) => {
  try {
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: { allow: 'POST, OPTIONS' } });
    if (req.method !== 'POST') return errorResponse('Method not allowed.', 405, 'method_not_allowed', { allow: 'POST' });

    if (!hasAccess(req)) return errorResponse('An access code is required.', 401, 'access_code_required');

    const rate = checkRate(clientIp(req, context));
    if (!rate.ok) {
      return errorResponse('You are sending messages too quickly. Please wait a moment.', 429, 'too_many_requests', {
        'retry-after': String(rate.retryAfterSec),
      });
    }

    const payload = await readJsonBody(req);
    if (payload && payload.action === 'title') return await handleTitle(payload, req);
    return await handleChat(payload, req);
  } catch (err) {
    if (err instanceof HttpError) return errorResponse(err.message, err.status, err.code, err.headers);
    if (err instanceof GeminiError) {
      const headers = err.retryAfterMs ? { 'retry-after': String(Math.ceil(err.retryAfterMs / 1000)) } : {};
      return errorResponse(err.message, err.status, err.code, headers);
    }
    console.error('Unhandled error in /api/chat', err);
    return errorResponse('Something went wrong on the server.', 500, 'server_error');
  }
};

async function handleChat(payload, req) {
  const { model, body } = buildChatRequest(payload);

  // "Who is the owner / co-founder?" gets a fixed answer, without calling the model.
  const fixed = ownerReply(payload.messages);
  if (fixed) return fixedStream(fixed, model);

  const started = Date.now();
  const { res, keyNumber, attempts } = await callGemini({
    model,
    action: 'streamGenerateContent?alt=sse',
    body,
    signal: req.signal,
  });
  console.log(JSON.stringify({ evt: 'chat', model, key: keyNumber, attempts, headersMs: Date.now() - started }));

  return new Response(relay(res, model), {
    status: 200,
    headers: {
      'content-type': 'application/x-ndjson; charset=utf-8',
      'cache-control': 'no-store, no-transform',
      'x-accel-buffering': 'no',
    },
  });
}

// Streams a fixed reply in the same NDJSON format the browser already understands.
function fixedStream(text, model) {
  const lines = [
    { type: 'start', model },
    { type: 'delta', text },
    { type: 'finish', reason: 'STOP', usage: null },
  ];
  return new Response(lines.map((l) => JSON.stringify(l) + '\n').join(''), {
    status: 200,
    headers: {
      'content-type': 'application/x-ndjson; charset=utf-8',
      'cache-control': 'no-store, no-transform',
      'x-accel-buffering': 'no',
    },
  });
}

// Turns Gemini's SSE stream into a minimal NDJSON stream for the browser.
function relay(upstream, model) {
  const encoder = new TextEncoder();
  const decoder = new TextDecoder();
  let reader;
  let cancelled = false;

  return new ReadableStream({
    async start(controller) {
      const send = (obj) => {
        if (!cancelled) controller.enqueue(encoder.encode(JSON.stringify(obj) + '\n'));
      };
      let emitted = false;
      let finish = null;
      let blocked = null;
      let usage = null;
      let failed = false;

      const handleEvent = (raw) => {
        const data = raw
          .split(/\r?\n/)
          .filter((l) => l.startsWith('data:'))
          .map((l) => l.slice(5).trimStart())
          .join('\n');
        if (!data || data === '[DONE]') return;
        let j;
        try { j = JSON.parse(data); } catch { return; }

        if (j.error) {
          failed = true;
          send({ type: 'error', code: 'upstream_error', message: String(j.error.message || 'The model returned an error.').slice(0, 300) });
          return;
        }
        if (j.promptFeedback?.blockReason) blocked = j.promptFeedback.blockReason;
        const cand = j.candidates && j.candidates[0];
        if (cand) {
          for (const part of cand.content?.parts || []) {
            if (typeof part.text === 'string' && part.text && !part.thought) {
              emitted = true;
              send({ type: 'delta', text: part.text });
            }
          }
          if (cand.finishReason) finish = cand.finishReason;
        }
        if (j.usageMetadata) {
          usage = {
            prompt: j.usageMetadata.promptTokenCount,
            output: j.usageMetadata.candidatesTokenCount,
            total: j.usageMetadata.totalTokenCount,
          };
        }
      };

      try {
        send({ type: 'start', model });
        reader = upstream.body.getReader();
        let buffer = '';
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          let m;
          while ((m = /\r?\n\r?\n/.exec(buffer))) {
            const raw = buffer.slice(0, m.index);
            buffer = buffer.slice(m.index + m[0].length);
            handleEvent(raw);
          }
        }
        buffer += decoder.decode();
        if (buffer.trim()) handleEvent(buffer);

        if (!failed) {
          if (!emitted) {
            const safety = blocked || finish === 'SAFETY' || finish === 'PROHIBITED_CONTENT' || finish === 'BLOCKLIST';
            send({
              type: 'error',
              code: safety ? 'blocked' : 'empty',
              message: safety ? BLOCK_MESSAGE : finish ? `The model returned no text (reason: ${finish}).` : 'The model returned an empty response.',
            });
          } else {
            send({ type: 'finish', reason: finish, usage });
          }
        }
      } catch (err) {
        if (!cancelled) {
          console.warn('stream interrupted', err?.message || err);
          send({ type: 'error', code: 'stream_error', message: 'The connection to the model was interrupted.' });
        }
      } finally {
        try { controller.close(); } catch { /* already closed */ }
      }
    },
    cancel() {
      cancelled = true;
      try { reader?.cancel(); } catch { /* ignore */ }
    },
  });
}

async function handleTitle(payload, req) {
  if (!smartTitlesEnabled()) return json({ title: null });
  const text = typeof payload.text === 'string' ? payload.text.trim().slice(0, 800) : '';
  if (!text) return json({ title: null });
  const reply = typeof payload.reply === 'string' ? payload.reply.trim().slice(0, 400) : '';

  const prompt =
    'Write a short title (2 to 5 words) for a chat that begins with the message below. ' +
    'Reply with the title only: no quotes, no trailing punctuation, same language as the message.\n\n' +
    `User message:\n${text}` +
    (reply ? `\n\nAssistant reply (start):\n${reply}` : '');

  try {
    const { res } = await callGemini({
      model: getTitleModel(),
      action: 'generateContent',
      body: {
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.3, maxOutputTokens: 64 },
      },
      signal: req.signal,
    });
    const data = await res.json();
    const raw = (data.candidates?.[0]?.content?.parts || []).map((p) => p.text || '').join('');
    const title = raw
      .split('\n')[0]
      .replace(/^["'“”‘’\s#*]+|["'“”‘’\s.!?:;*]+$/g, '')
      .slice(0, 60)
      .trim();
    return json({ title: title || null });
  } catch (err) {
    // Titles are a nicety; never surface an error for them.
    console.warn('title generation failed', err?.message || err);
    return json({ title: null });
  }
}
