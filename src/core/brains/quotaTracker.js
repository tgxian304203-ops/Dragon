/* ═══════════════════════════════════════════════════════════════
   📊 QUOTA TRACKER
   
   CƠ CHẾ RESET THỰC TẾ:
   - Groq: đọc header x-ratelimit-* (RPD reset midnight UTC)
   - Gemini: tự đếm, 1.500 RPD, reset midnight PT
   - OpenRouter: tự đếm, 50 RPD, reset midnight UTC
   ═══════════════════════════════════════════════════════════════ */

const BrainKey = require('../../models/brainKey.model');
const logger = require('../../utils/logger');

// Limit RPD cho provider không có header
const RPD_LIMIT = {
  gemini: 1500,
  openrouter: 50,
};

// TTL reset theo provider (ms) — dùng cho Gemini/OpenRouter
const QUOTA_RESET_TTL = {
  gemini: 24 * 60 * 60 * 1000,
  groq: 60 * 1000,
  openrouter: 24 * 60 * 60 * 1000,
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
 * Tăng request counter cho Gemini/OpenRouter.
 * Reset nếu đã qua ngày mới.
 */
async function tangRequest(keyId, provider) {
  try {
    const key = await BrainKey.findById(keyId).lean();
    if (!key) return;

    const now = Date.now();
    const resetAt = key.requestsResetAt ? new Date(key.requestsResetAt).getTime() : 0;

    // Reset counter nếu qua ngày mới
    if (now >= resetAt) {
      await BrainKey.updateOne(
        { _id: keyId },
        { $set: { requestsToday: 1, requestsResetAt: new Date(now + QUOTA_RESET_TTL[provider]) } }
      );
      return;
    }

    await BrainKey.updateOne(
      { _id: keyId },
      { $inc: { requestsToday: 1 } }
    );
  } catch (err) {
    logger.error(`Lỗi tăng request key ${keyId}:`, err.message);
  }
}

/**
 * Tính quota từ bộ đếm (Gemini/OpenRouter).
 */
function tinhQuotaTuDem(key) {
  if (!key) return 100;

  const provider = key.provider || 'gemini';
  const limit = RPD_LIMIT[provider] || 1500;

  const now = Date.now();
  const resetAt = key.requestsResetAt ? new Date(key.requestsResetAt).getTime() : 0;

  // Qua ngày mới → reset về 100%
  if (now >= resetAt) return 100;

  const used = key.requestsToday || 0;
  const remaining = Math.max(0, limit - used);
  return Math.round((remaining / limit) * 100);
}

/**
 * Trả quota hiệu dụng có xét TTL reset.
 */
function layQuotaHieuDung(key) {
  if (!key) return 0;

  const provider = key.provider || 'groq';

  // Gemini/OpenRouter → tính từ bộ đếm
  if (provider === 'gemini' || provider === 'openrouter') {
    return tinhQuotaTuDem(key);
  }

  // Groq → đọc quotaPercent (đã cập nhật từ header)
  const rawPercent = typeof key.quotaPercent === 'number' ? key.quotaPercent : 100;
  if (rawPercent > 0) return rawPercent;

  // Groq hết quota → xét TTL 60s
  const ttl = QUOTA_RESET_TTL.groq;
  const updatedAt = key.quotaUpdatedAt ? new Date(key.quotaUpdatedAt).getTime() : 0;
  const now = Date.now();

  if (updatedAt && now - updatedAt >= ttl) {
    return 100;
  }
  return 0;
}

/**
 * Số ms còn phải chờ (cho UI).
 */
function tinhConLaiMs(key) {
  if (!key) return 0;

  const provider = key.provider || 'groq';

  // Gemini/OpenRouter → không chờ, chỉ đếm theo ngày
  if (provider === 'gemini' || provider === 'openrouter') {
    const now = Date.now();
    const resetAt = key.requestsResetAt ? new Date(key.requestsResetAt).getTime() : 0;
    if (now < resetAt && tinhQuotaTuDem(key) === 0) {
      return resetAt - now;
    }
    return 0;
  }

  // Groq → chờ nếu quota 0
  const rawPercent = typeof key.quotaPercent === 'number' ? key.quotaPercent : 100;
  if (rawPercent > 0) return 0;

  const ttl = QUOTA_RESET_TTL.groq;
  const updatedAt = key.quotaUpdatedAt ? new Date(key.quotaUpdatedAt).getTime() : 0;
  if (!updatedAt) return 0;

  const conLai = updatedAt + ttl - Date.now();
  return conLai > 0 ? conLai : 0;
}

module.exports = {
  updateQuota,
  markExhausted,
  tangRequest,
  tinhQuotaTuDem,
  layQuotaHieuDung,
  tinhConLaiMs,
  QUOTA_RESET_TTL,
  RPD_LIMIT,
};