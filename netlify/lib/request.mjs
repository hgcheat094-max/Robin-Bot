// Validates what the browser sends and converts it to a Gemini request body.

import { HttpError } from './http.mjs';
import {
  LIMITS,
  getModels,
  getDefaultModel,
  getSystemPrompt,
  getMaxOutputTokens,
} from './config.mjs';

const ALLOWED_MIME = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/heic', 'image/heif']);
const BASE64 = /^[A-Za-z0-9+/]+={0,2}$/;

export async function readJsonBody(req) {
  const declared = Number(req.headers.get('content-length') || 0);
  if (declared > LIMITS.maxBodyBytes) {
    throw new HttpError(413, 'The request is too large. Try fewer or smaller images.', 'too_large');
  }
  const text = await req.text();
  if (text.length > LIMITS.maxBodyBytes) {
    throw new HttpError(413, 'The request is too large. Try fewer or smaller images.', 'too_large');
  }
  try {
    return JSON.parse(text);
  } catch {
    throw new HttpError(400, 'The request body is not valid JSON.');
  }
}

function cleanMessage(m, index) {
  if (!m || typeof m !== 'object') throw new HttpError(400, `Message ${index + 1} is invalid.`);
  if (m.role !== 'user' && m.role !== 'assistant') throw new HttpError(400, `Message ${index + 1} has an invalid role.`);

  const text = typeof m.text === 'string' ? m.text : '';
  if (text.length > LIMITS.maxCharsPerMessage) {
    throw new HttpError(413, 'A message is too long.', 'too_large');
  }

  const images = Array.isArray(m.images) ? m.images : [];
  if (images.length > LIMITS.maxImagesPerMessage) {
    throw new HttpError(400, `A message can include at most ${LIMITS.maxImagesPerMessage} images.`);
  }
  for (const img of images) {
    if (!img || !ALLOWED_MIME.has(img.mime)) {
      throw new HttpError(400, 'Unsupported image type. Use PNG, JPEG, WebP, HEIC or HEIF.', 'bad_image');
    }
    if (typeof img.data !== 'string' || !img.data || !BASE64.test(img.data)) {
      throw new HttpError(400, 'An image could not be read.', 'bad_image');
    }
  }
  if (m.role === 'assistant' && images.length) {
    throw new HttpError(400, 'Assistant messages cannot include images.');
  }
  return { role: m.role, text, images };
}

export function buildChatRequest(payload) {
  if (!payload || typeof payload !== 'object') throw new HttpError(400, 'Invalid request.');

  const models = getModels();
  const model = payload.model || getDefaultModel();
  if (!models.some((m) => m.id === model)) throw new HttpError(400, 'Unknown model.', 'bad_model');

  if (!Array.isArray(payload.messages) || payload.messages.length === 0) {
    throw new HttpError(400, 'No messages provided.');
  }
  if (payload.messages.length > LIMITS.maxMessages) {
    throw new HttpError(400, 'The conversation is too long to send.', 'too_large');
  }

  let messages = payload.messages.map(cleanMessage);
  // Gemini wants the conversation to start with a user turn.
  while (messages.length && messages[0].role !== 'user') messages.shift();
  if (!messages.length || messages[messages.length - 1].role !== 'user') {
    throw new HttpError(400, 'The last message must come from the user.');
  }

  const contents = messages.map((m) => {
    const parts = m.images.map((img) => ({ inlineData: { mimeType: img.mime, data: img.data } }));
    // Images first, then text, as recommended for multimodal prompts.
    if (m.text.trim() || parts.length === 0) parts.push({ text: m.text.trim() ? m.text : ' ' });
    return { role: m.role === 'assistant' ? 'model' : 'user', parts };
  });

  const custom = typeof payload.system === 'string' ? payload.system.trim().slice(0, LIMITS.maxSystemChars) : '';
  const base = getSystemPrompt();
  const systemText = custom
    ? `${base}\n\nThe user has set these custom instructions. Follow them:\n${custom}`
    : base;

  const t = Number(payload.temperature);
  const temperature = Number.isFinite(t) ? Math.min(2, Math.max(0, t)) : 1;

  return {
    model,
    body: {
      systemInstruction: { parts: [{ text: systemText }] },
      contents,
      generationConfig: { temperature, maxOutputTokens: getMaxOutputTokens() },
    },
  };
}
