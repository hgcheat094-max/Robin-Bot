// Test harness (not used in production): serves /public, runs the real Netlify
// function modules, and fakes the Gemini API so the whole app can be driven by a
// browser without real keys.   node test/e2e-server.mjs [port]

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const port = Number(process.argv[2] || 8899);

/* ---------- fake Gemini ---------- */
export const mock = { calls: [], mode: 'ok' };

const REPLY = [
  'Here is a **summary**:\n\n',
  '- First point\n- Second point with `inline code`\n\n',
  '```js\nconst answer = 42; // the answer\nconsole.log(answer);\n```\n\n',
  '| Name | Score |\n|:--|--:|\n| Ada | 10 |\n| Linus | 9 |\n\n',
  'Done. See https://example.com for more.'
];

const gemini = http.createServer((req, res) => {
  let raw = '';
  req.on('data', (c) => (raw += c));
  req.on('end', async () => {
    const key = req.headers['x-goog-api-key'];
    let body = {};
    try { body = JSON.parse(raw); } catch { /* ignore */ }
    mock.calls.push({ url: req.url, key, body });

    if (req.url.includes(':generateContent')) {
      res.writeHead(200, { 'content-type': 'application/json' });
      return res.end(JSON.stringify({ candidates: [{ content: { parts: [{ text: 'Markdown And Code Help' }] } }] }));
    }
    if (mock.mode === 'rate') {
      res.writeHead(429, { 'content-type': 'application/json' });
      return res.end(JSON.stringify({ error: { code: 429, message: 'Quota exceeded' } }));
    }
    const last = body.contents?.[body.contents.length - 1];
    const hasImage = last?.parts?.some((p) => p.inlineData);
    const chunks = hasImage ? ['I can see an image ', 'in your message.'] : REPLY;

    res.writeHead(200, { 'content-type': 'text/event-stream' });
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    for (let i = 0; i < chunks.length; i++) {
      if (mode() === 'slow') await sleep(400);
      else await sleep(25);
      const last = i === chunks.length - 1;
      res.write(`data: ${JSON.stringify({ candidates: [{ content: { role: 'model', parts: [{ text: chunks[i] }] }, ...(last ? { finishReason: 'STOP' } : {}) }] })}\r\n\r\n`);
    }
    res.end();
  });
});
const mode = () => mock.mode;

/* ---------- static + functions ---------- */
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml' };

export async function start() {
  await new Promise((r) => gemini.listen(0, '127.0.0.1', r));
  process.env.GEMINI_API_BASE = `http://127.0.0.1:${gemini.address().port}/v1beta`;
  process.env.RATE_LIMIT_PER_MIN = '0';
  if (!process.env.GEMINI_API_KEYS && !process.env.GEMINI_API_KEY_1) {
    process.env.GEMINI_API_KEYS = 'test-key-1,test-key-2,test-key-3,test-key-4';
  }

  const chat = (await import('../netlify/functions/chat.mjs')).default;
  const health = (await import('../netlify/functions/health.mjs')).default;

  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, `http://${req.headers.host}`);

    if (url.pathname === '/api/chat' || url.pathname === '/api/health') {
      const chunks = [];
      for await (const c of req) chunks.push(c);
      const webReq = new Request(url, {
        method: req.method,
        headers: req.headers,
        body: ['GET', 'HEAD'].includes(req.method) ? undefined : Buffer.concat(chunks),
      });
      const out = await (url.pathname === '/api/chat' ? chat : health)(webReq, { ip: '127.0.0.1' });
      res.writeHead(out.status, Object.fromEntries(out.headers));
      if (!out.body) return res.end();
      const reader = out.body.getReader();
      res.on('close', () => reader.cancel().catch(() => {}));
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        res.write(value);
      }
      return res.end();
    }

    let file = url.pathname === '/' ? '/index.html' : url.pathname;
    file = path.join(root, 'public', path.normalize(file));
    if (!file.startsWith(path.join(root, 'public')) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
      res.writeHead(404);
      return res.end('not found');
    }
    res.writeHead(200, { 'content-type': types[path.extname(file)] || 'application/octet-stream' });
    fs.createReadStream(file).pipe(res);
  });

  await new Promise((r) => server.listen(port, '127.0.0.1', r));
  return { server, port, close: () => { server.close(); gemini.close(); } };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const s = await start();
  console.log(`e2e server on http://127.0.0.1:${s.port}`);
}
