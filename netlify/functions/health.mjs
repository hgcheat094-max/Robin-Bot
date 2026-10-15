// GET /api/health
//
// Tells the browser which models to offer and whether an access code is needed.
// Only the NUMBER of configured keys is reported, never the keys themselves.

import { json } from '../lib/http.mjs';
import { loadKeys } from '../lib/keys.mjs';
import { accessRequired } from '../lib/guard.mjs';
import { getAppName, getDefaultModel, getModels, smartTitlesEnabled, LIMITS } from '../lib/config.mjs';

export const config = { path: '/api/health' };

export default async () =>
  json({
    ok: true,
    app: getAppName(),
    keys: loadKeys().length,
    models: getModels(),
    defaultModel: getDefaultModel(),
    requiresAccessCode: accessRequired(),
    smartTitles: smartTitlesEnabled(),
    limits: { maxBodyBytes: LIMITS.maxBodyBytes, maxImagesPerMessage: LIMITS.maxImagesPerMessage },
  });
