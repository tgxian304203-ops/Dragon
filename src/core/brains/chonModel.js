/* ═══════════════════════════════════════════════════════════════
   🎯 CHỌN MODEL — sắp xếp provider theo quota còn lại
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

/**
 * Sắp xếp provider theo quota trung bình còn lại (giảm dần).
 * Provider hết quota (avg=0) sẽ đứng cuối.
 */
function getProviderOrder(keysByProvider) {
  const providers = [];

  for (const p of ['gemini', 'groq', 'openrouter']) {
    const keys = keysByProvider[p];
    if (!keys || keys.length === 0) continue;

    const avgQuota =
      keys.reduce((sum, k) => sum + (k.quotaPercent ?? 100), 0) / keys.length;

    providers.push({ provider: p, avgQuota });
  }

  // Sắp xếp giảm dần theo quota
  providers.sort((a, b) => b.avgQuota - a.avgQuota);

  return providers.map((x) => x.provider);
}

module.exports = { pickNextModel, groupModelsByKeys, groupKeysByProvider, getProviderOrder };