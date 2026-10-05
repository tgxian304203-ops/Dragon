/* ═══════════════════════════════════════════════════════════════
   📊 QUOTA TRACKER
   
   CƠ CHẾ RESET THỰC TẾ:
   - Groq: đọc header x-ratelimit-* + retry-after khi 429
   - Gemini: tự đếm, 1.500 RPD, reset midnight PT
   - OpenRouter: tự đếm, 50 RPD, reset midnight UTC
   
   [SỬA] Thêm field quotaResetAt (Date) — thời điểm key hồi thực tế
   ═══════════════════════════════════════════════════════════════ */

const BrainKey = require('../../models/brainKey.model');
const logger = require('../../utils/logger');

const RPD_LIMIT = {
  gemini: 1500,
  openrouter: 50,
};

// TTL mặc định theo provider (ms) — dùng khi không có retry-after
const QUOTA_RESET_TTL = {
  gemini: 24 * 60 * 60 * 1000,       // 24h
  groq: 60 * 1000,                    // 60s (RPM) — nhưng sẽ override bằng retryAfter
  openrouter: 24 * 60 * 60 * 1000,   // 24h
};

// TTL cooldown cho lỗi 503 (server overload)
const COOLDOWN_503_MS = 5 * 60 * 1000;   // 5 phút

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
      {
        $set: {
          quotaPercent: percent,
          quotaUpdatedAt: new Date(),
          quotaResetAt: null,   // Xóa reset — key đang OK
        },
      }
    );
    return percent;
  } catch (err) {
    logger.error(`Lỗi cập nhật quota key ${keyId}:`, err.message);
    return null;
  }
}

/**
 * [SỬA] markExhausted có thể nhận retryAfterMs để set quotaResetAt chính xác.
 */
async function markExhausted(keyId, retryAfterMs = null) {
  try {
    const update = {
      quotaPercent: 0,
      quotaUpdatedAt: new Date(),
    };

    // Nếu có retryAfterMs → set thời điểm reset
    if (retryAfterMs && retryAfterMs > 0) {
      update.quotaResetAt = new Date(Date.now() + retryAfterMs);
    } else {
      // Không có → xóa quotaResetAt (dùng TTL mặc định)
      update.quotaResetAt = null;
    }

    await BrainKey.updateOne({ _id: keyId }, { $set: update });
  } catch (err) {
    logger.error(`Lỗi mark exhausted key ${keyId}:`, err.message);
  }
}

/**
 * [MỚI] Đánh dấu key đang bị server overload (503).
 */
async function markOverloaded(keyId) {
  try {
    await BrainKey.updateOne(
      { _id: keyId },
      {
        $set: {
          quotaResetAt: new Date(Date.now() + COOLDOWN_503_MS),
        },
      }
    );
  } catch (err) {
    logger.error(`Lỗi mark overloaded key ${keyId}:`, err.message);
  }
}

async function tangRequest(keyId, provider) {
  try {
    const key = await BrainKey.findById(keyId).lean();
    if (!key) return;

    const now = Date.now();
    const resetAt = key.requestsResetAt ? new Date(key.requestsResetAt).getTime() : 0;

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

function tinhQuotaTuDem(key) {
  if (!key) return 100;

  const provider = key.provider || 'gemini';
  const limit = RPD_LIMIT[provider] || 1500;

  const now = Date.now();
  const resetAt = key.requestsResetAt ? new Date(key.requestsResetAt).getTime() : 0;

  if (now >= resetAt) return 100;

  const used = key.requestsToday || 0;
  const remaining = Math.max(0, limit - used);
  return Math.round((remaining / limit) * 100);
}

/**
 * [SỬA] Trả quota hiệu dụng:
 * 1. Nếu có quotaResetAt và chưa qua → 0 (đang chờ)
 * 2. Nếu có quotaResetAt và đã qua → 100 (đã hồi)
 * 3. Nếu không có quotaResetAt:
 *    - Gemini/OR: tính từ đếm
 *    - Groq: đọc quotaPercent, nếu 0 → xét TTL 60s
 */
function layQuotaHieuDung(key) {
  if (!key) return 0;

  const now = Date.now();
  const resetAt = key.quotaResetAt ? new Date(key.quotaResetAt).getTime() : 0;

  // [SỬA] Có quotaResetAt → kiểm tra đã qua chưa
  if (resetAt > 0) {
    if (now >= resetAt) {
      // Đã qua thời điểm reset → coi như hồi
      return 100;
    }
    // Chưa qua → đang chờ
    return 0;
  }

  const provider = key.provider || 'groq';

  // Gemini/OpenRouter → tính từ bộ đếm
  if (provider === 'gemini' || provider === 'openrouter') {
    return tinhQuotaTuDem(key);
  }

  // Groq → đọc quotaPercent
  const rawPercent = typeof key.quotaPercent === 'number' ? key.quotaPercent : 100;
  if (rawPercent > 0) return rawPercent;

  // Groq hết quota + không có quotaResetAt → dùng TTL 60s
  const ttl = QUOTA_RESET_TTL.groq;
  const updatedAt = key.quotaUpdatedAt ? new Date(key.quotaUpdatedAt).getTime() : 0;

  if (updatedAt && now - updatedAt >= ttl) {
    return 100;
  }
  return 0;
}

/**
 * [SỬA] Trả số ms còn phải chờ.
 */
function tinhConLaiMs(key) {
  if (!key) return 0;

  const now = Date.now();
  const resetAt = key.quotaResetAt ? new Date(key.quotaResetAt).getTime() : 0;

  // Có quotaResetAt → tính chính xác
  if (resetAt > 0) {
    const conLai = resetAt - now;
    return conLai > 0 ? conLai : 0;
  }

  const provider = key.provider || 'groq';

  // Gemini/OR → chờ đến requestsResetAt
  if (provider === 'gemini' || provider === 'openrouter') {
    const reqResetAt = key.requestsResetAt ? new Date(key.requestsResetAt).getTime() : 0;
    if (now < reqResetAt && tinhQuotaTuDem(key) === 0) {
      return reqResetAt - now;
    }
    return 0;
  }

  // Groq → dùng TTL 60s
  const rawPercent = typeof key.quotaPercent === 'number' ? key.quotaPercent : 100;
  if (rawPercent > 0) return 0;

  const ttl = QUOTA_RESET_TTL.groq;
  const updatedAt = key.quotaUpdatedAt ? new Date(key.quotaUpdatedAt).getTime() : 0;
  if (!updatedAt) return 0;

  const conLai = updatedAt + ttl - now;
  return conLai > 0 ? conLai : 0;
}

module.exports = {
  updateQuota,
  markExhausted,
  markOverloaded,
  tangRequest,
  tinhQuotaTuDem,
  layQuotaHieuDung,
  tinhConLaiMs,
  QUOTA_RESET_TTL,
  COOLDOWN_503_MS,
  RPD_LIMIT,
};