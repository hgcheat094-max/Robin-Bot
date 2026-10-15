// Backend tests. A local mock stands in for the Gemini API so key rotation,
// failover and streaming can be verified without real keys.
// Run with: npm test

import { test, beforeEach, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';

import chat from '../netlify/functions/chat.mjs';
import health from '../netlify/functions/health.mjs';
import { __resetKeyState } from '../netlify/lib/keys.mjs';
import { __resetRate } from '../netlify/lib/guard.mjs';

const KEYS = ['AIza-test-key-AAAA', 'AIza-test-key-BBBB', 'AIza-test-key-CCCC', 'AIza-test-key-DDDD'];

let server;
let hits; // key -> number of upstream requests
let behavior; // key -> 'ok' | '429' | '429day' | 'invalid' | 'bad400' | '503'
let lastBody;

const sse = (obj) => `data: ${JSON.stringify(obj)}\r\n\r\n`;

before(async () => {
  server = http.createServer((req, res) => {
    const key = req.headers['x-goog-api-key'];
    hits[key] = (hits[key] || 0) + 1;
    let raw = '';
    req.on('data', (c) => (raw += c));
    req.on('end', () => {
      try { lastBody = JSON.parse(raw); } catch { lastBody = null; }
      const b = behavior[key] || 'ok';
      const fail = (status, body, headers = {}) => {
        res.writeHead(status, { 'content-type': 'application/json', ...headers });
        res.end(JSON.stringify(body));
      };
      if (b === '429') return fail(429, { error: { code: 429, status: 'RESOURCE_EXHAUSTED', message: 'Quota exceeded', details: [{ retryDelay: '40s' }] } });
      if (b === '429day') return fail(429, { error: { code: 429, message: 'Quota exceeded for GenerateRequestsPerDayPerProjectPerModel-FreeTier' } });
      if (b === 'invalid') return fail(400, { error: { code: 400, message: 'API key not valid. Please pass a valid API key.', status: 'INVALID_ARGUMENT' } });
      if (b === 'bad400') return fail(400, { error: { code: 400, message: 'Unable to process input image.' } });
      if (b === '503') return fail(503, { error: { code: 503, message: 'The model is overloaded.' } });

      if (req.url.includes(':generateContent')) {
        return fail(200, { candidates: [{ content: { parts: [{ text: '"Trip Planning Tips".' }] } }] });
      }

      // Streaming response, deliberately split in the middle of an event to
      // exercise the incremental SSE parser.
      res.writeHead(200, { 'content-type': 'text/event-stream' });
      const e1 = sse({ candidates: [{ content: { role: 'model', parts: [{ text: 'Hello' }] } }] });
      const e2 = sse({ candidates: [{ content: { role: 'model', parts: [{ text: ', ' }, { text: 'hidden thought', thought: true }] } }] });
      const e3 = sse({ candidates: [{ content: { role: 'model', parts: [{ text: 'world!' }] }, finishReason: 'STOP' }], usageMetadata: { promptTokenCount: 5, candidatesTokenCount: 3, totalTokenCount: 8 } });
      const all = e1 + e2 + e3;
      const cut = Math.floor(e1.length + e2.length / 2);
      res.write(all.slice(0, cut));
      setTimeout(() => { res.write(all.slice(cut)); res.end(); }, 15);
    });
  });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  process.env.GEMINI_API_BASE = `http://127.0.0.1:${server.address().port}/v1beta`;
});

after(() => server.close());

beforeEach(() => {
  hits = {};
  behavior = {};
  lastBody = null;
  __resetKeyState();
  __resetRate();
  for (const k of Object.keys(process.env)) if (k.startsWith('GEMINI_API_KEY')) delete process.env[k];
  delete process.env.ACCESS_CODE;
  process.env.RATE_LIMIT_PER_MIN = '0'; // limiter off unless a test turns it on
  KEYS.forEach((k, i) => (process.env[`GEMINI_API_KEY_${i + 1}`] = k));
});

const chatPayload = (extra = {}) => ({
  model: 'gemini-3.8-flash',
  messages: [{ role: 'user', text: 'Hi there', images: [] }],
  ...extra,
});

const post = (payload, headers = {}) =>
  chat(
    new Request('http://localhost/api/chat', {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...headers },
      body: JSON.stringify(payload),
    }),
    { ip: '203.0.113.7' }
  );

const events = async (res) =>
  (await res.text()).split('\n').filter(Boolean).map((l) => JSON.parse(l));

test('streams text, drops thought parts, and finishes', async () => {
  const res = await post(chatPayload());
  assert.equal(res.status, 200);
  assert.match(res.headers.get('content-type'), /ndjson/);
  const evs = await events(res);
  const text = evs.filter((e) => e.type === 'delta').map((e) => e.text).join('');
  assert.equal(text, 'Hello, world!');
  const fin = evs.find((e) => e.type === 'finish');
  assert.equal(fin.reason, 'STOP');
  assert.equal(fin.usage.total, 8);
  assert.ok(!evs.some((e) => e.type === 'error'));
});

test('spreads load evenly across all four keys', async () => {
  for (let i = 0; i < 40; i++) {
    const res = await post(chatPayload());
    assert.equal(res.status, 200, `request ${i}`);
    await res.text();
  }
  assert.deepEqual(KEYS.map((k) => hits[k]), [10, 10, 10, 10]);
});

test('fails over to another key on 429 and cools the limited key down', async () => {
  behavior[KEYS[0]] = '429';
  behavior[KEYS[1]] = '429';
  for (let i = 0; i < 12; i++) {
    const res = await post(chatPayload());
    assert.equal(res.status, 200, `request ${i} should succeed via a healthy key`);
    await res.text();
  }
  // Each limited key is hit at most once; afterwards it is skipped during cooldown.
  assert.ok((hits[KEYS[0]] || 0) <= 1, `key 1 hit ${hits[KEYS[0]]} times`);
  assert.ok((hits[KEYS[1]] || 0) <= 1, `key 2 hit ${hits[KEYS[1]]} times`);
  // Every request ends with exactly one success on a healthy key.
  assert.equal((hits[KEYS[2]] || 0) + (hits[KEYS[3]] || 0), 12);
});

test('skips an invalid key', async () => {
  behavior[KEYS[2]] = 'invalid';
  for (let i = 0; i < 8; i++) assert.equal((await post(chatPayload())).status, 200);
  assert.ok(hits[KEYS[2]] <= 1);
});

test('fails over on upstream 503', async () => {
  KEYS.slice(0, 3).forEach((k) => (behavior[k] = '503'));
  const res = await post(chatPayload());
  assert.equal(res.status, 200);
  assert.equal((await events(res)).filter((e) => e.type === 'delta').length > 0, true);
});

test('returns 429 with Retry-After when every key is rate limited', async () => {
  KEYS.forEach((k) => (behavior[k] = '429'));
  const res = await post(chatPayload());
  assert.equal(res.status, 429);
  const body = await res.json();
  assert.equal(body.code, 'rate_limited');
  assert.equal(res.headers.get('retry-after'), '40');
  assert.equal(Object.values(hits).reduce((a, b) => a + b, 0), 4, 'each key tried exactly once');
});

test('reports daily quota exhaustion separately', async () => {
  KEYS.forEach((k) => (behavior[k] = '429day'));
  const res = await post(chatPayload());
  assert.equal(res.status, 429);
  assert.match((await res.json()).error, /daily quota/i);
});

test('reports bad keys when all are rejected', async () => {
  KEYS.forEach((k) => (behavior[k] = 'invalid'));
  const res = await post(chatPayload());
  assert.equal(res.status, 500);
  assert.equal((await res.json()).code, 'bad_keys');
});

test('does not burn through keys on a request-level 400', async () => {
  KEYS.forEach((k) => (behavior[k] = 'bad400'));
  const res = await post(chatPayload());
  assert.equal(res.status, 400);
  assert.match((await res.json()).error, /image/i);
  assert.equal(Object.values(hits).reduce((a, b) => a + b, 0), 1, 'only one key tried');
});

test('reports a clear error when no keys are configured', async () => {
  for (let i = 1; i <= 4; i++) delete process.env[`GEMINI_API_KEY_${i}`];
  const res = await post(chatPayload());
  assert.equal(res.status, 500);
  assert.equal((await res.json()).code, 'no_keys');
});

test('supports a comma-separated GEMINI_API_KEYS variable', async () => {
  for (let i = 1; i <= 4; i++) delete process.env[`GEMINI_API_KEY_${i}`];
  process.env.GEMINI_API_KEYS = 'k-one, k-two ,k-three';
  for (let i = 0; i < 9; i++) await (await post(chatPayload())).text();
  delete process.env.GEMINI_API_KEYS;
  assert.deepEqual([hits['k-one'], hits['k-two'], hits['k-three']], [3, 3, 3]);
});

test('forwards images as inlineData before the text and includes the system prompt', async () => {
  const res = await post(
    chatPayload({
      system: 'Always answer in French.',
      messages: [
        { role: 'user', text: 'What is this?', images: [{ mime: 'image/png', data: 'iVBORw0KGgo=' }] },
        { role: 'assistant', text: 'A tiny image.' },
        { role: 'user', text: 'And now?' },
      ],
    })
  );
  assert.equal(res.status, 200);
  await res.text();
  const first = lastBody.contents[0];
  assert.equal(first.role, 'user');
  assert.deepEqual(first.parts[0], { inlineData: { mimeType: 'image/png', data: 'iVBORw0KGgo=' } });
  assert.deepEqual(first.parts[1], { text: 'What is this?' });
  assert.equal(lastBody.contents[1].role, 'model');
  assert.match(lastBody.systemInstruction.parts[0].text, /Always answer in French/);
});

test('rejects bad input', async () => {
  let r = await post(chatPayload({ model: 'not-a-model' }));
  assert.equal(r.status, 400);
  r = await post(chatPayload({ messages: [{ role: 'user', text: 'x', images: [{ mime: 'image/svg+xml', data: 'AAAA' }] }] }));
  assert.equal(r.status, 400);
  r = await post(chatPayload({ messages: [{ role: 'user', text: 'x', images: [{ mime: 'image/png', data: 'not base64!!' }] }] }));
  assert.equal(r.status, 400);
  r = await post(chatPayload({ messages: [{ role: 'assistant', text: 'x' }] }));
  assert.equal(r.status, 400);
  r = await post(chatPayload({ messages: [] }));
  assert.equal(r.status, 400);
  assert.deepEqual(hits, {}, 'invalid requests never reach Gemini');
});

test('rejects oversized bodies', async () => {
  const big = 'A'.repeat(6 * 1024 * 1024);
  const res = await post(chatPayload({ messages: [{ role: 'user', text: 'x', images: [{ mime: 'image/png', data: big }] }] }));
  assert.equal(res.status, 413);
});

test('enforces the access code when configured', async () => {
  process.env.ACCESS_CODE = 'open-sesame';
  let res = await post(chatPayload());
  assert.equal(res.status, 401);
  assert.equal((await res.json()).code, 'access_code_required');
  res = await post(chatPayload(), { 'x-access-code': 'wrong' });
  assert.equal(res.status, 401);
  res = await post(chatPayload(), { 'x-access-code': 'open-sesame' });
  assert.equal(res.status, 200);
  await res.text();
});

test('rate limits a single IP', async () => {
  process.env.RATE_LIMIT_PER_MIN = '3';
  const codes = [];
  for (let i = 0; i < 5; i++) {
    const r = await post(chatPayload());
    codes.push(r.status);
    await r.text();
  }
  assert.deepEqual(codes, [200, 200, 200, 429, 429]);
});

test('rejects non-POST methods', async () => {
  const res = await chat(new Request('http://localhost/api/chat', { method: 'GET' }), {});
  assert.equal(res.status, 405);
});

test('generates a clean chat title', async () => {
  const res = await post({ action: 'title', text: 'Help me plan a trip to Japan', reply: 'Sure!' });
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), { title: 'Trip Planning Tips' });
});

test('title failures are silent', async () => {
  KEYS.forEach((k) => (behavior[k] = '429'));
  const res = await post({ action: 'title', text: 'hello' });
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), { title: null });
});

test('health reports config but never the keys', async () => {
  const res = await health(new Request('http://localhost/api/health'));
  const text = await res.text();
  const body = JSON.parse(text);
  assert.equal(body.ok, true);
  assert.equal(body.keys, 4);
  assert.equal(body.models.length >= 1, true);
  for (const k of KEYS) assert.ok(!text.includes(k), 'key leaked in /api/health');
});

test('owner / co-founder questions get the fixed answer without calling the model', async () => {
  for (const q of ['Who is the owner?', 'who is your co founder', 'Co-founder?', 'owner', 'Who is the founder of Dragon?', 'who owns you']) {
    const res = await post(chatPayload({ messages: [{ role: 'user', text: q, images: [] }] }));
    assert.equal(res.status, 200, q);
    const evs = await events(res);
    assert.equal(evs.filter((e) => e.type === 'delta').map((e) => e.text).join(''), 'Yogesh Bangari', q);
    assert.equal(evs.at(-1).type, 'finish', q);
  }
  assert.deepEqual(hits, {}, 'fixed answers never reach the API');
});

test('questions about other owners or founders still go to the model', async () => {
  for (const q of ['Who is the owner of Google?', 'Who is the founder of Tesla?', 'How do I find the owner of a domain name?', 'Hi there']) {
    const res = await post(chatPayload({ messages: [{ role: 'user', text: q, images: [] }] }));
    const text = (await events(res)).filter((e) => e.type === 'delta').map((e) => e.text).join('');
    assert.equal(text, 'Hello, world!', q);
  }
});
