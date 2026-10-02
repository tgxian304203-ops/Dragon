/* ═══════════════════════════════════════════════════════════════
   🏆 MODEL PRIORITY
   ═══════════════════════════════════════════════════════════════ */

const { MODEL_PRIORITY } = require('../../config/providers');

function rankOf(provider, modelId) {
  const list = MODEL_PRIORITY[provider] || [];
  const idx = list.indexOf(modelId);
  return idx === -1 ? 9999 : idx;
}

function isInPriority(provider, modelId) {
  return (MODEL_PRIORITY[provider] || []).includes(modelId);
}

function sortByPriority(provider, models) {
  return [...models].sort((a, b) => rankOf(provider, a) - rankOf(provider, b));
}

module.exports = { rankOf, isInPriority, sortByPriority };