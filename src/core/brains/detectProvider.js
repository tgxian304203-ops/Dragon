/* ═══════════════════════════════════════════════════════════════
   🔍 DETECT PROVIDER
   ═══════════════════════════════════════════════════════════════ */

const gemini = require('../providers/gemini.adapter');
const groq = require('../providers/groq.adapter');
const openrouter = require('../providers/openrouter.adapter');
const logger = require('../../utils/logger');

const PREFIX_MAP = [
  { prefix: 'gsk_',      provider: 'groq' },
  { prefix: 'AIza',      provider: 'gemini' },
  { prefix: 'sk-or-v1-', provider: 'openrouter' },
];

function fromPrefix(apiKey) {
  for (const { prefix, provider } of PREFIX_MAP) {
    if (apiKey.startsWith(prefix)) return provider;
  }
  return null;
}

async function fromApiTest(apiKey) {
  const tries = [
    { name: 'groq',       fn: () => groq.listModels(apiKey) },
    { name: 'gemini',     fn: () => gemini.listModels(apiKey) },
    { name: 'openrouter', fn: () => openrouter.listModels(apiKey) },
  ];

  for (const { name, fn } of tries) {
    try {
      const models = await fn();
      if (Array.isArray(models)) return name;
    } catch (err) {
      logger.debug(`Test ${name} fail:`, err.message);
    }
  }
  return null;
}

async function detectProvider(apiKey) {
  if (!apiKey || typeof apiKey !== 'string') throw new Error('Key không hợp lệ');

  const trimmed = apiKey.trim();

  const byPrefix = fromPrefix(trimmed);
  if (byPrefix) return { provider: byPrefix, method: 'prefix' };

  const byApi = await fromApiTest(trimmed);
  if (byApi) return { provider: byApi, method: 'api_test' };

  throw new Error('Không nhận diện được provider của key');
}

module.exports = { detectProvider };