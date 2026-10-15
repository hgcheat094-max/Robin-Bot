// Calls the Gemini REST API, rotating across the configured keys with failover.

import { loadKeys, orderKeys, markFailure, markSuccess } from './keys.mjs';

const apiBase = () =>
  (process.env.GEMINI_API_BASE || 'https://generativelanguage.googleapis.com/v1beta').replace(/\/+$/, '');

export class GeminiError extends Error {
  constructor(message, { status = 502, code = 'upstream_error', retryAfterMs } = {}) {
    super(message);
    this.status = status;
    this.code = code;
    this.retryAfterMs = retryAfterMs;
  }
}

function retryDelayMs(res, text) {
  const header = res.headers.get('retry-after');
  if (header && /^\d+$/.test(header)) return Math.min(parseInt(header, 10) * 1000, 15 * 60_000);
  const m = /"retryDelay"\s*:\s*"(\d+(?:\.\d+)?)s"/.exec(text);
  if (m) return Math.min(Math.ceil(parseFloat(m[1]) * 1000), 15 * 60_000);
  return undefined;
}

// Decide what a failed upstream response means for the key and for the request.
//  rate / quota_daily / invalid / server -> try the next key
//  client                                -> the request itself is bad; no key will fix it
function classify(status, text) {
  if (status === 429) return /PerDay|per day|daily/i.test(text) ? 'quota_daily' : 'rate';
  if (status === 400 && /API_KEY_INVALID|API key not valid|API key expired|API key not found/i.test(text)) return 'invalid';
  if (status === 401 || status === 403) return 'invalid';
  if (status === 408 || status >= 500) return 'server';
  return 'client';
}

function upstreamMessage(text, status) {
  try {
    const msg = JSON.parse(text)?.error?.message;
    if (msg) return String(msg).slice(0, 400);
  } catch { /* not JSON */ }
  return `The model returned an error (HTTP ${status}).`;
}

/**
 * @param {object} o
 * @param {string} o.model       Gemini model id
 * @param {string} o.action      e.g. "streamGenerateContent?alt=sse" or "generateContent"
 * @param {object} o.body        request body for the Gemini API
 * @param {AbortSignal} [o.signal]
 * @returns {Promise<{res: Response, keyNumber: number, attempts: number}>}
 */
export async function callGemini({ model, action, body, signal, keys = loadKeys(), headerTimeoutMs = 30_000 }) {
  if (!keys.length) {
    throw new GeminiError('The server has no Gemini API keys configured.', { status: 500, code: 'no_keys' });
  }

  const url = `${apiBase()}/models/${encodeURIComponent(model)}:${action}`;
  const failures = []; // { kind, retryAfterMs }
  let attempts = 0;

  for (const key of orderKeys(keys)) {
    if (signal?.aborted) throw new GeminiError('Request cancelled.', { status: 499, code: 'cancelled' });
    attempts++;
    const keyNumber = keys.indexOf(key) + 1;

    // Abort the connection if headers take too long, but keep the controller
    // linked to the client signal so cancelling still stops the body stream.
    const controller = new AbortController();
    const onAbort = () => controller.abort();
    signal?.addEventListener('abort', onAbort, { once: true });
    const timer = setTimeout(() => controller.abort(), headerTimeoutMs);

    let res;
    try {
      res = await fetch(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-goog-api-key': key },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
    } catch (err) {
      clearTimeout(timer);
      signal?.removeEventListener('abort', onAbort);
      if (signal?.aborted) throw new GeminiError('Request cancelled.', { status: 499, code: 'cancelled' });
      markFailure(key, 'server');
      failures.push({ kind: 'server' });
      console.warn(JSON.stringify({ evt: 'gemini_network_error', key: keyNumber, error: String(err?.message || err) }));
      continue;
    }
    clearTimeout(timer);

    if (res.ok) {
      markSuccess(key);
      return { res, keyNumber, attempts };
    }

    signal?.removeEventListener('abort', onAbort);
    const text = await res.text().catch(() => '');
    const kind = classify(res.status, text);
    console.warn(JSON.stringify({ evt: 'gemini_error', key: keyNumber, status: res.status, kind }));

    if (kind === 'client') {
      // Same request would fail on every key; do not burn through the pool.
      const code = res.status === 404 ? 'model_not_found' : 'bad_request';
      throw new GeminiError(upstreamMessage(text, res.status), { status: res.status === 404 ? 404 : 400, code });
    }

    const retryAfterMs = retryDelayMs(res, text);
    markFailure(key, kind, retryAfterMs);
    failures.push({ kind, retryAfterMs });
  }

  // Every key failed.
  const limited = failures.filter((f) => f.kind === 'rate' || f.kind === 'quota_daily');
  if (limited.length === failures.length) {
    const waits = failures.map((f) => f.retryAfterMs).filter(Boolean);
    const daily = failures.every((f) => f.kind === 'quota_daily');
    throw new GeminiError(
      daily
        ? 'All API keys have used up their daily quota. Please try again later.'
        : 'All API keys are currently rate limited. Please wait a moment and try again.',
      { status: 429, code: 'rate_limited', retryAfterMs: waits.length ? Math.min(...waits) : 30_000 }
    );
  }
  if (failures.every((f) => f.kind === 'invalid')) {
    throw new GeminiError('The server\'s Gemini API keys were rejected. Check the keys in the site settings.', {
      status: 500,
      code: 'bad_keys',
    });
  }
  throw new GeminiError('The Gemini API is temporarily unavailable. Please try again.', {
    status: 502,
    code: 'upstream_unavailable',
  });
}
