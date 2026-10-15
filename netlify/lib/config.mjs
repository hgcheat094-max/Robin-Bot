// Runtime configuration, all read lazily from environment variables so it can be
// changed in the Netlify UI without touching code.

const env = (name, fallback) => {
  const v = process.env[name];
  return v !== undefined && v !== '' ? v : fallback;
};

export const DEFAULT_MODELS = [
  { id: 'gemini-3.8-flash', label: 'Gemini 3.8 Flash', description: 'Fast and capable for everyday tasks' },
  { id: 'gemini-4-argon', label: 'Gemini 4 Argon', description: 'Flagship model for complex reasoning and code' },
  { id: 'gemini-3.5-flash-lite', label: 'Gemini 3.5 Flash-Lite', description: 'Fastest, with the highest rate limits' },
];

export function getModels() {
  const raw = env('GEMINI_MODELS', '');
  if (!raw.trim()) return DEFAULT_MODELS;
  const list = raw
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry) => {
      const [id, label, description] = entry.split('|').map((x) => (x ? x.trim() : ''));
      return { id, label: label || id, description: description || '' };
    })
    // The id ends up in a URL path, so keep it to safe characters.
    .filter((m) => /^[a-zA-Z0-9._-]+$/.test(m.id));
  return list.length ? list : DEFAULT_MODELS;
}

export function getDefaultModel() {
  const models = getModels();
  const wanted = env('DEFAULT_MODEL', models[0].id);
  return models.some((m) => m.id === wanted) ? wanted : models[0].id;
}

export const getAppName = () => env('APP_NAME', 'Gemini Chat');
export const getTitleModel = () => env('TITLE_MODEL', 'gemini-3.5-flash-lite');
export const smartTitlesEnabled = () => env('SMART_TITLES', 'true').toLowerCase() !== 'false';
export const getMaxOutputTokens = () => Number(env('MAX_OUTPUT_TOKENS', '32768')) || 32768;

export const getSystemPrompt = () =>
  env(
    'SYSTEM_PROMPT',
    'You are a helpful, accurate and friendly AI assistant. Answer clearly and concisely. ' +
      'Use Markdown when it improves readability, and put code in fenced code blocks with a language tag. ' +
      'If the user shares an image, describe and analyse what you can actually see.'
  );

export const LIMITS = {
  maxBodyBytes: 5.5 * 1024 * 1024, // Netlify rejects synchronous function payloads above ~6 MB
  maxMessages: 60,
  maxCharsPerMessage: 40000,
  maxImagesPerMessage: 6,
  maxSystemChars: 4000,
};
