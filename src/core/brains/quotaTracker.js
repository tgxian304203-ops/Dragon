/* ═══════════════════════════════════════════════════════════════
   📊 QUOTA TRACKER (NT14, NP14)
   ═══════════════════════════════════════════════════════════════ */

const BrainKey = require('../../models/brainKey.model');
const logger = require('../../utils/logger');

function normalizeRateLimit(rateLimit) {
  if (!rateLimit) return null;

  if (rateLimit.limitRequests != null && rateLimit.remainingRequests != null) {
    return { limit: rateLimit.limitRequests, remaining: rateLimit.remainingRequests };
  }
  if (rateLimit.limit != null && rateLimit.remaining != null) {
    return { limit: rateLimit.limit, remaining: rateLimit.remaining };
  }
  return null;
}

async function updateQuota(keyId, rateLimit) {
  const normalized = normalizeRateLimit(rateLimit);
  if (!normalized) return null;

  const { limit, remaining } = normalized;
  let percent = limit > 0 ? (remaining / limit) * 100 : 0;
  percent = Math.max(0, Math.min(100, Math.round(percent)));

  try {
    await BrainKey.updateOne(
      { _id: keyId },
      { $set: { quotaPercent: percent, quotaUpdatedAt: new Date() } }
    );
    return percent;
  } catch (err) {
    logger.error(`Lỗi cập nhật quota key ${keyId}:`, err.message);
    return null;
  }
}

async function markExhausted(keyId) {
  try {
    await BrainKey.updateOne(
      { _id: keyId },
      { $set: { quotaPercent: 0, quotaUpdatedAt: new Date() } }
    );
  } catch (err) {
    logger.error(`Lỗi mark exhausted key ${keyId}:`, err.message);
  }
}

module.exports = { updateQuota, markExhausted };