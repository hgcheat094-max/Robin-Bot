// Optional access code + best-effort per-IP rate limit.
//
// Without these, anyone who finds your URL can spend your Gemini quota.

import { createHash, timingSafeEqual } from 'node:crypto';

const sha = (s) => createHash('sha256').update(String(s)).digest();

export function accessRequired() {
  return Boolean(process.env.ACCESS_CODE);
}

export function hasAccess(req) {
  const required = process.env.ACCESS_CODE;
  if (!required) return true;
  const given = req.headers.get('x-access-code') || '';
  return timingSafeEqual(sha(given), sha(required));
}

export function clientIp(req, context) {
  return (
    context?.ip ||
    req.headers.get('x-nf-client-connection-ip') ||
    (req.headers.get('x-forwarded-for') || '').split(',')[0].trim() ||
    'unknown'
  );
}

// Sliding one-minute window, kept in memory. Netlify may run several function
// instances, so this is a speed bump rather than a hard guarantee.
const hits = new Map();

export function checkRate(ip, now = Date.now()) {
  const raw = process.env.RATE_LIMIT_PER_MIN;
  const limit = raw === undefined || raw === '' ? 30 : Number(raw);
  if (!(limit > 0)) return { ok: true };

  const windowStart = now - 60_000;
  const recent = (hits.get(ip) || []).filter((t) => t > windowStart);
  if (recent.length >= limit) {
    hits.set(ip, recent);
    return { ok: false, retryAfterSec: Math.max(1, Math.ceil((recent[0] + 60_000 - now) / 1000)) };
  }
  recent.push(now);
  hits.set(ip, recent);

  if (hits.size > 5000) {
    for (const [k, v] of hits) if (!v.some((t) => t > windowStart)) hits.delete(k);
  }
  return { ok: true };
}

export function __resetRate() {
  hits.clear();
}
