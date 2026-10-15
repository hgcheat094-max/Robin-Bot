// API key pool: loads the keys from the environment and decides which one to
// try first for each request.
//
// Netlify Functions are stateless, so there is no shared counter between
// invocations. Instead we combine three cheap tricks:
//   1. every warm instance starts at a random offset and advances round-robin,
//      which spreads traffic evenly across the keys over many requests;
//   2. a key that just returned 429 / 401 / 403 is put on a short cooldown and
//      tried last (state lives in memory for the life of the warm instance);
//   3. the caller (gemini.mjs) fails over to the next key within the SAME
//      request, so a single exhausted key is invisible to the user.

export function loadKeys(env = process.env) {
  const found = [];
  const add = (value) => {
    if (typeof value !== 'string') return;
    const key = value.trim();
    if (key && !found.includes(key)) found.push(key);
  };
  if (env.GEMINI_API_KEYS) env.GEMINI_API_KEYS.split(/[\s,;]+/).forEach(add);
  for (let i = 1; i <= 10; i++) add(env[`GEMINI_API_KEY_${i}`]);
  add(env.GEMINI_API_KEY);
  return found;
}

const cooldowns = new Map(); // key -> { until: epoch ms, kind }
let cursor = Math.floor(Math.random() * 1000);

export function orderKeys(keys, now = Date.now()) {
  const n = keys.length;
  if (!n) return [];
  const start = cursor++ % n;
  const rotated = keys.map((_, i) => keys[(start + i) % n]);
  const healthy = [];
  const cooling = [];
  for (const key of rotated) {
    const c = cooldowns.get(key);
    if (c && c.until > now) cooling.push(key);
    else healthy.push(key);
  }
  // If everything is cooling down, try the one that recovers soonest first.
  cooling.sort((a, b) => cooldowns.get(a).until - cooldowns.get(b).until);
  return [...healthy, ...cooling];
}

const MINUTE = 60_000;

export function markFailure(key, kind, retryAfterMs) {
  let ms;
  switch (kind) {
    case 'rate': ms = retryAfterMs ?? MINUTE; break; // per-minute limit
    case 'quota_daily': ms = retryAfterMs ?? 30 * MINUTE; break; // daily quota used up
    case 'invalid': ms = 10 * MINUTE; break; // bad / revoked key
    default: ms = 5_000; // transient server problem
  }
  cooldowns.set(key, { until: Date.now() + ms, kind });
}

export function markSuccess(key) {
  cooldowns.delete(key);
}

export function keyState(key, now = Date.now()) {
  const c = cooldowns.get(key);
  return c && c.until > now ? c : null;
}

// Test helper.
export function __resetKeyState() {
  cooldowns.clear();
  cursor = 0;
}
