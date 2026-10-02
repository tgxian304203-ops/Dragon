/* ═══════════════════════════════════════════════════════════════
   📋 DO MODEL — Dò + LỌC MODEL FREE (NT6, NT7, NP6, NP7, TU3)
   ═══════════════════════════════════════════════════════════════ */

const gemini = require('../providers/gemini.adapter');
const groq = require('../providers/groq.adapter');
const openrouter = require('../providers/openrouter.adapter');
const { MODEL_PRIORITY, GEMINI_FREE_MODELS } = require('../../config/providers');
const logger = require('../../utils/logger');

const ADAPTERS = { gemini, groq, openrouter };

function filterFreeModels(provider, models) {
  if (provider === 'gemini') {
    return models.filter((m) => GEMINI_FREE_MODELS.has(m));
  }
  if (provider === 'groq') {
    return models;
  }
  if (provider === 'openrouter') {
    return models.filter((m) => m.endsWith(':free'));
  }
  return models;
}

function sortByPriority(provider, models) {
  const priority = MODEL_PRIORITY[provider] || [];
  const prioritySet = new Set(priority);

  const ordered = [];
  for (const p of priority) {
    if (models.includes(p)) ordered.push(p);
  }
  for (const m of models) {
    if (!prioritySet.has(m)) ordered.push(m);
  }

  return ordered;
}

async function doModel(provider, apiKey) {
  const adapter = ADAPTERS[provider];
  if (!adapter) throw new Error(`Provider ${provider} không hỗ trợ`);

  const raw = await adapter.listModels(apiKey);
  const rawCount = raw.length;

  const freeOnly = filterFreeModels(provider, raw);
  const sorted = sortByPriority(provider, freeOnly);

  logger.debug(`${provider}: ${rawCount} thô → ${sorted.length} free`);

  return {
    models: sorted,
    count: sorted.length,
    rawCount,
  };
}

module.exports = { doModel, filterFreeModels, sortByPriority };