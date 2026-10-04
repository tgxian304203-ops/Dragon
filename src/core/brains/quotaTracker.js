/* ═══════════════════════════════════════════════════════════════
   📊 QUOTA TRACKER
   
   CƠ CHẾ RESET THỰC TẾ (theo tài liệu provider):
   - Groq: RPM reset 60s, RPD reset nửa đêm UTC
   - Gemini: RPM reset 60s, RPD reset nửa đêm PT
   - OpenRouter: RPM reset 60s, RPD reset nửa đêm UTC
   
   → TTL dùng chung 60 giây (RPM reset).
   → Nếu hết RPD → gọi lại sau 60s vẫn 429 → markExhausted lại → nghỉ tiếp.
   ═══════════════════════════════════════════════════════════════ */

const BrainKey = require('../../models/brainKey.model');
const logger = require('../../utils/logger');

// TTL reset quota — tất cả provider reset RPM sau 60 giây
const QUOTA_RESET_TTL = {
  gemini: 60 * 1000,
  groq: 60 * 1000,
  openrouter: 60 * 1000,
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
 * Trả quota hiệu dụng có xét TTL reset.
 * - quotaPercent > 0 → trả nguyên
 * - quotaPercent = 0 nhưng đã qua TTL (60s) → coi như hồi 100%
 * - quotaPercent = 0 và chưa đủ TTL → 0
 */
function layQuotaHieuDung(key) {
  if (!key) return 0;

  const rawPercent = typeof key.quotaPercent === 'number' ? key.quotaPercent : 100;
  if (rawPercent > 0) return rawPercent;

  const provider = key.provider || 'groq';
  const ttl = QUOTA_RESET_TTL[provider] || QUOTA_RESET_TTL.groq;

  const updatedAt = key.quotaUpdatedAt ? new Date(key.quotaUpdatedAt).getTime() : 0;
  const now = Date.now();

  if (updatedAt && now - updatedAt >= ttl) {
    return 100;
  }
  return 0;
}

/**
 * Số ms còn phải chờ để key hồi quota (nếu đang 0%).
 * Trả 0 nếu key không cần chờ.
 */
function tinhConLaiMs(key) {
  if (!key) return 0;

  const rawPercent = typeof key.quotaPercent === 'number' ? key.quotaPercent : 100;
  if (rawPercent > 0) return 0;

  const provider = key.provider || 'groq';
  const ttl = QUOTA_RESET_TTL[provider] || QUOTA_RESET_TTL.groq;

  const updatedAt = key.quotaUpdatedAt ? new Date(key.quotaUpdatedAt).getTime() : 0;
  if (!updatedAt) return 0;

  const conLai = updatedAt + ttl - Date.now();
  return conLai > 0 ? conLai : 0;
}

module.exports = {
  updateQuota,
  markExhausted,
  layQuotaHieuDung,
  tinhConLaiMs,
  QUOTA_RESET_TTL,
};