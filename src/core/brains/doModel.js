/* ═══════════════════════════════════════════════════════════════
   📋 DO MODEL — Dò + LỌC MODEL FREE + BLOCKLIST RÁC
   ═══════════════════════════════════════════════════════════════ */

const gemini = require('../providers/gemini.adapter');
const groq = require('../providers/groq.adapter');
const openrouter = require('../providers/openrouter.adapter');
const { MODEL_PRIORITY, GEMINI_FREE_MODELS } = require('../../config/providers');
const { isBlocked } = require('./modelPriority');
const logger = require('../../utils/logger');

const ADAPTERS = { gemini, groq, openrouter };

function filterFreeModels(provider, models) {
  let filtered = models;

  // [MỚI] Lọc blocklist model rác (whisper, guard, safeguard, tts, embed...)
  filtered = filtered.filter((m) => !isBlocked(m));

  if (provider === 'gemini') {
    return filtered.filter((m) => GEMINI_FREE_MODELS.has(m));
  }
  if (provider === 'groq') {
    return filtered;
  }
  if (provider === 'openrouter') {
    return filtered.filter((m) => m.endsWith(':free'));
  }
  return filtered;
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

  logger.debug(`${provider}: ${rawCount} thô → ${sorted.length} free (sau blocklist)`);

  return {
    models: sorted,
    count: sorted.length,
    rawCount,
  };
}

module.exports = { doModel, filterFreeModels, sortByPriority };