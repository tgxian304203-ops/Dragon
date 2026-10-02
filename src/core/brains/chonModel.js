/* ═══════════════════════════════════════════════════════════════
   🎯 CHỌN MODEL — chọn theo MODEL, không theo key
   ═══════════════════════════════════════════════════════════════ */

const { sortByPriority } = require('./modelPriority');

function groupModelsByKeys(keys) {
  const modelMap = {};

  for (const key of keys) {
    const models = key.availableModels || [];
    for (const m of models) {
      if (!modelMap[m]) modelMap[m] = [];
      modelMap[m].push({
        keyId: key._id,
        provider: key.provider,
        quotaPercent: key.quotaPercent ?? 100,
      });
    }
  }

  return modelMap;
}

function pickNextModel(provider, keys, triedModels = new Set()) {
  const modelMap = groupModelsByKeys(keys);
  const sorted = sortByPriority(provider, Object.keys(modelMap));

  for (const modelId of sorted) {
    if (triedModels.has(modelId)) continue;

    const keyList = [...modelMap[modelId]].sort(
      (a, b) => b.quotaPercent - a.quotaPercent
    );

    return { modelId, keys: keyList };
  }

  return null;
}

function groupKeysByProvider(keys) {
  const map = { gemini: [], groq: [], openrouter: [] };
  for (const key of keys) {
    if (map[key.provider]) map[key.provider].push(key);
  }
  return map;
}

function getProviderOrder(keysByProvider) {
  const order = [];
  for (const p of ['gemini', 'groq', 'openrouter']) {
    if (keysByProvider[p] && keysByProvider[p].length > 0) order.push(p);
  }
  return order;
}

module.exports = { pickNextModel, groupModelsByKeys, groupKeysByProvider, getProviderOrder };