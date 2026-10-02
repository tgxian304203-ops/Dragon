/* ═══════════════════════════════════════════════════════════════
   ✅ VALIDATE KEY
   ═══════════════════════════════════════════════════════════════ */

const gemini = require('../providers/gemini.adapter');
const groq = require('../providers/groq.adapter');
const openrouter = require('../providers/openrouter.adapter');
const logger = require('../../utils/logger');

const ADAPTERS = { gemini, groq, openrouter };

async function validateKey(provider, apiKey) {
  const adapter = ADAPTERS[provider];
  if (!adapter) {
    return { alive: false, models: [], error: `Provider ${provider} không hỗ trợ` };
  }

  try {
    const models = await adapter.listModels(apiKey);
    return {
      alive: true,
      models: Array.isArray(models) ? models : [],
      error: null,
    };
  } catch (err) {
    logger.debug(`Validate ${provider} fail:`, err.message);
    const isAuthError = /40[13]/.test(err.message) || /unauthorized|forbidden/i.test(err.message);
    return {
      alive: !isAuthError,
      models: [],
      error: err.message,
    };
  }
}

module.exports = { validateKey };