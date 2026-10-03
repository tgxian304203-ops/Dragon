/* ═══════════════════════════════════════════════════════════════
   📊 QUOTA TRACKER (NT14, NP14)
   - updateQuota: cập nhật % quota từ header API
   - markExhausted: đánh dấu hết quota
   - layQuotaHieuDung: trả quota có xét TTL reset
   ═══════════════════════════════════════════════════════════════ */

const BrainKey = require('../../models/brainKey.model');
const logger = require('../../utils/logger');

// TTL reset quota theo provider (ms)
const QUOTA_RESET_TTL = {
  gemini: 24 * 60 * 60 * 1000,    // 24h — Gemini reset quota hàng ngày
  groq: 60 * 60 * 1000,            // 1h — Groq reset nhanh
  openrouter: 24 * 60 * 60 * 1000, // 24h
};

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

/**
 * [MỚI] Trả quota hiệu dụng có xét TTL.
 * Nếu quotaPercent=0 nhưng đã quá TTL reset của provider → coi như quota reset.
 */
function layQuotaHieuDung(key) {
  if (!key) return 0;

  const rawPercent = typeof key.quotaPercent === 'number' ? key.quotaPercent : 100;
  if (rawPercent > 0) return rawPercent;

  const provider = key.provider || 'gemini';
  const ttl = QUOTA_RESET_TTL[provider] || QUOTA_RESET_TTL.gemini;

  const updatedAt = key.quotaUpdatedAt ? new Date(key.quotaUpdatedAt).getTime() : 0;
  const now = Date.now();

  // Đã quá TTL → coi như quota reset, trả về 50 (giả định có thể dùng lại)
  if (updatedAt && now - updatedAt >= ttl) {
    return 50;
  }

  return 0;
}

module.exports = { updateQuota, markExhausted, layQuotaHieuDung, QUOTA_RESET_TTL };