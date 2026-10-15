# Gemini Chat

A ChatGPT-style chat app for the Gemini API. It accepts text and images, streams replies, and spreads requests across 3–4 Gemini API keys. There is no build step; it deploys to Netlify as static files plus two serverless functions.

```
public/                 static front end (HTML, CSS, vanilla JS, no CDN, no framework)
netlify/functions/
  chat.mjs              POST /api/chat    streams Gemini replies, also makes chat titles
  health.mjs            GET  /api/health  model list + key count (never the keys)
netlify/lib/            key rotation, Gemini client, validation, rate limit
test/                   unit tests + a browser test harness with a fake Gemini
```

API keys live only in server-side environment variables. The browser never sees them.

## Deploy to Netlify

1. Push this folder to a GitHub/GitLab repo, then **Add new project → Import an existing project** in Netlify. `netlify.toml` already sets the publish folder (`public`) and functions folder, so leave the build command empty.
   (Drag-and-drop deploys don't build functions. Use Git, or run `npx netlify-cli deploy --prod` from this folder.)
2. Under **Project configuration → Environment variables**, add:

   | Variable | Value |
   |---|---|
   | `GEMINI_API_KEY_1` … `GEMINI_API_KEY_4` | your keys (or one `GEMINI_API_KEYS=k1,k2,k3,k4`) |
   | `ACCESS_CODE` | a passphrase visitors must enter. **Set this on a public URL**, or anyone can spend your quota. |

3. Redeploy. Open `/api/health` on your site; `"keys": 4` confirms the keys were picked up.

Everything else in `.env.example` (models, system prompt, rate limit, app name) is optional.

## How the multi-key rotation works

Netlify functions are stateless, so there is no shared counter. Each request does this:

1. Each warm function instance rotates through the keys round-robin, starting at a random key, so load spreads evenly.
2. If a key returns `429` (rate limit or daily quota), `401/403`, an invalid-key error or a `5xx`, it goes on a cooldown (using Google's `retryDelay` when given) and **the same request is retried on the next key**. The user doesn't notice a single exhausted key.
3. A request that is itself bad (for example an unreadable image) is *not* retried on other keys, so one bad request can't burn through the pool.
4. If every key is limited, the user sees a clear "all keys are rate limited, wait a moment" message.

**Important:** Gemini quotas are per Google Cloud *project*, not per key. Create each key in a different project (AI Studio → Get API key → *Create API key in new project*). Several keys from one project share one quota and won't raise your limit.

## Features

- ChatGPT-like layout: sidebar with history and search, model picker, streaming replies, Markdown with syntax-highlighted code and copy buttons, tables, regenerate, edit-and-resend, thumbs, stop button
- Image input by button, drag and drop, or paste. Images are downscaled in the browser so several photos fit in a serverless request
- Conversations are stored in your browser (IndexedDB), with auto-generated titles, export, light/dark/system theme and custom instructions
- Works on phones; strict Content-Security-Policy and security headers in `netlify.toml`

## Limits to know about

- **60 s per reply.** Netlify's synchronous function limit is 60 seconds ([docs](https://docs.netlify.com/build/functions/configuration)). A very long answer is cut off and marked as interrupted in the UI. The Flash models stay well inside this; Argon with heavy reasoning on a long answer may not.
- **About 4.5 MB of images per request.** Netlify caps request bodies at 6 MB, and base64 adds about 30%. The app resizes images and drops the oldest images from the history if a request would exceed it.
- **The per-IP rate limit is per warm instance.** It slows abuse but isn't a hard guarantee; `ACCESS_CODE` is the real protection.
- Model ids change over time. The defaults (`gemini-3.8-flash`, `gemini-4-argon`, `gemini-3.5-flash-lite`) match Google's [model list](https://ai.google.dev/gemini-api/docs/models) as of October 2026. The 2.5 models are now limited to existing users ([deprecations](https://ai.google.dev/gemini-api/docs/deprecations)). Change them with `GEMINI_MODELS` without touching code.

## Develop locally

```bash
cp .env.example .env       # add your keys
npm run dev                # netlify dev → http://localhost:8888
npm test                   # 37 tests: rotation, failover, streaming, validation, Markdown
node test/e2e-server.mjs   # UI against a fake Gemini, no keys needed → http://127.0.0.1:8899
```

## Testing status

The tests and the browser run use a fake Gemini server, so rotation, failover, streaming and image handling are verified end to end. This build has **not** been run against the live Gemini API, because that needs your keys. After deploying, send one text message and one image on each model to confirm. Google's docs don't state image support for `gemini-4-argon`, so check that one first.
