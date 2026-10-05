/* ═══════════════════════════════════════════════════════════════
   📞 GỌI MODEL — TIER-FIRST
   - [SỬA] 429: đọc retry-after → markExhausted với TTL chính xác
   - [SỬA] 503: markOverloaded → cooldown 5 phút
   ═══════════════════════════════════════════════════════════════ */

const BrainKey = require('../../models/brainKey.model');
const gemini = require('../providers/gemini.adapter');
const groq = require('../providers/groq.adapter');
const openrouter = require('../providers/openrouter.adapter');
const { getTier } = require('../../config/providers');
const { isBlocked } = require('./modelPriority');
const quotaTracker = require('./quotaTracker');
const modelCache = require('./modelCache');
const { doModel } = require('./doModel');
const logger = require('../../utils/logger');

const ADAPTERS = { gemini, groq, openrouter };

/* ═══════════════════════════════════════════════════════════════
   HELPERS
   ═══════════════════════════════════════════════════════════════ */

async function loadAliveKeys(side, userId, guestSessionId) {
  const query = { side, alive: true };
  if (userId) query.userId = userId;
  else if (guestSessionId) query.guestSessionId = guestSessionId;
  else throw new Error('Thiếu owner');

  return BrainKey.find(query).lean();
}

async function ensureModels(side, key) {
  const keyIdStr = String(key._id);
  const cached = modelCache.get(side, keyIdStr);
  if (cached && cached.length > 0) return cached;

  if (key.availableModels && key.availableModels.length > 0) {
    modelCache.set(side, keyIdStr, key.availableModels);
    return key.availableModels;
  }

  try {
    const { models } = await doModel(key.provider, key.keyValue);
    modelCache.set(side, keyIdStr, models);
    await BrainKey.updateOne(
      { _id: key._id },
      { $set: { availableModels: models } }
    );
    return models;
  } catch (err) {
    logger.warn(`Không dò được model key ${keyIdStr} (${key.provider}): ${err.message}`);
    return [];
  }
}

function isModelDeadError(status, message) {
  if (status === 404) return true;
  if (status === 400 && /decommission|not found|invalid model|model.*not.*exist/i.test(message || '')) {
    return true;
  }
  return false;
}

/* ═══════════════════════════════════════════════════════════════
   [MỚI] PARSE RETRY-AFTER
   ═══════════════════════════════════════════════════════════════ */

/**
 * Parse thời gian retry-after từ error message.
 * Groq trả: "Please try again in 13m32.592s"
 * → 13m32.592s = 13*60 + 32.592 = 812.592s = 812592ms
 */
function parseRetryAfterMs(message) {
  if (!message || typeof message !== 'string') return null;

  // Pattern: "in 13m32.592s" hoặc "in 47.66s" hoặc "in 2m59.56s"
  const match = message.match(/in\s+(?:(\d+)m)?(\d+(?:\.\d+)?)s/i);
  if (!match) return null;

  const minutes = match[1] ? parseInt(match[1], 10) : 0;
  const seconds = parseFloat(match[2]);
  const totalMs = (minutes * 60 + seconds) * 1000;

  return Math.round(totalMs);
}

/* ═══════════════════════════════════════════════════════════════
   MAIN — TIER-FIRST
   ═══════════════════════════════════════════════════════════════ */

async function callModel({ side, userId, guestSessionId, messages, options = {} }) {
  if (!['left', 'right'].includes(side)) {
    throw new Error('side phải là left/right');
  }

  const excludeModels = new Set(
    Array.isArray(options.excludeModels) ? options.excludeModels : []
  );

  /* BƯỚC 1 — Load key + sort theo quota */
  const keys = await loadAliveKeys(side, userId, guestSessionId);
  if (keys.length === 0) {
    throw new Error(`Não ${side === 'left' ? 'trái' : 'phải'} chưa có key nào hoạt động`);
  }

  for (const k of keys) {
    k._quotaHieuDung = quotaTracker.layQuotaHieuDung(k);
    k._conLaiMs = quotaTracker.tinhConLaiMs(k);
  }
  keys.sort((a, b) => b._quotaHieuDung - a._quotaHieuDung);

  logger.info(
    `🎯 Não ${side === 'left' ? 'trái' : 'phải'} — ${keys.length} key: ` +
    keys.map((k) => `${k.provider}(${k._quotaHieuDung}%${k._conLaiMs > 0 ? ' chờ ' + Math.round(k._conLaiMs / 60000) + 'p' : ''})`).join(' → ')
  );

  /* BƯỚC 2 — Dò model */
  for (const key of keys) {
    key._models = await ensureModels(side, key);
  }

  /* BƯỚC 3 — Gộp model pool */
  const modelPool = new Map();

  for (const key of keys) {
    const models = key._models || [];
    for (const modelId of models) {
      if (isBlocked(modelId)) continue;
      if (excludeModels.has(modelId)) continue;
      if (modelCache.isDead(key.provider, modelId)) {
        logger.debug(`💀 Skip model chết: ${key.provider}/${modelId}`);
        continue;
      }

      if (!modelPool.has(modelId)) modelPool.set(modelId, []);
      modelPool.get(modelId).push({
        keyId: key._id,
        keyValue: key.keyValue,
        provider: key.provider,
        quota: key._quotaHieuDung,
        tier: getTier(modelId),
      });
    }
  }

  if (modelPool.size === 0) {
    throw new Error(`Não ${side === 'left' ? 'trái' : 'phải'}: không có model nào khả dụng`);
  }

  /* BƯỚC 4 — Group theo TIER */
  const tierGroups = new Map();

  for (const modelId of modelPool.keys()) {
    const tier = getTier(modelId);
    if (!tierGroups.has(tier)) tierGroups.set(tier, []);
    tierGroups.get(tier).push(modelId);
  }

  const sortedTiers = [...tierGroups.keys()].sort((a, b) => a - b);

  logger.debug(
    `🎯 Model pool: ${modelPool.size} model — ` +
    `các tier: ${sortedTiers.map((t) => `T${t}[${tierGroups.get(t).length}]`).join(' ')}`
  );

  const lastErrors = [];

  /* BƯỚC 5 — Loop từng TIER */
  for (const tier of sortedTiers) {
    const modelsInTier = tierGroups.get(tier);
    modelsInTier.sort();

    for (const modelId of modelsInTier) {
      const keyCandidates = modelPool.get(modelId) || [];
      keyCandidates.sort((a, b) => b.quota - a.quota);

      for (const cand of keyCandidates) {
        if (cand.quota <= 0) {
          logger.debug(`⏭️ Skip key ${cand.provider} — quota 0%`);
          continue;
        }

        const adapter = ADAPTERS[cand.provider];
        if (!adapter) continue;

        try {
          logger.debug(`→ Gọi ${cand.provider}/${modelId}`);

          const result = await adapter.chat(cand.keyValue, modelId, messages, options);

          // Cập nhật quota
          if (cand.provider === 'groq') {
            if (result.rateLimit) {
              await quotaTracker.updateQuota(cand.keyId, result.rateLimit);
            }
          } else if (cand.provider === 'gemini' || cand.provider === 'openrouter') {
            await quotaTracker.tangRequest(cand.keyId, cand.provider);
          }

          logger.success(`✅ Gọi OK: ${cand.provider}/${modelId} (T${tier})`);

          return {
            text: result.text,
            usage: result.usage || {},
            provider: cand.provider,
            modelId,
            keyId: cand.keyId,
          };
        } catch (err) {
          const status = err.status;
          logger.warn(`❌ Lỗi ${cand.provider}/${modelId}: ${err.message}`);
          lastErrors.push(`${cand.provider}/${modelId}: ${err.message}`);

          // 404 — model chết
          if (isModelDeadError(status, err.message)) {
            modelCache.markDead(cand.provider, modelId);
            logger.warn(`☠️ Model ${cand.provider}/${modelId} chết → blacklist 1h`);
            break;
          }

          // 401/403 — key chết
          if (status === 401 || status === 403) {
            await BrainKey.updateOne({ _id: cand.keyId }, { $set: { alive: false } });
            modelCache.clear(side, String(cand.keyId));
            logger.warn(`☠️ Key ${cand.provider} chết → bỏ`);
            continue;
          }

          // 429 — hết quota
          if (status === 429) {
            const retryAfterMs = parseRetryAfterMs(err.message);
            if (retryAfterMs) {
              await quotaTracker.markExhausted(cand.keyId, retryAfterMs);
              logger.warn(
                `🔋 Key ${cand.provider} hết quota → chờ ${Math.round(retryAfterMs / 1000)}s (đã set quotaResetAt)`
              );
            } else {
              await quotaTracker.markExhausted(cand.keyId);
              logger.warn(`🔋 Key ${cand.provider} hết quota (không có retry-after → dùng TTL mặc định)`);
            }
            cand.quota = 0;
            continue;
          }

          // [MỚI] 503 — server overload
          if (status === 503) {
            await quotaTracker.markOverloaded(cand.keyId);
            logger.warn(`🔥 Server ${cand.provider} quá tải → cooldown 5 phút`);
            continue;
          }

          // 400 khác — thử key tiếp
          continue;
        }
      }
    }
  }

  throw new Error(
    `Não ${side === 'left' ? 'trái' : 'phải'}: tất cả tier thất bại. ` +
    `Chi tiết: ${lastErrors.slice(-5).join(' | ')}`
  );
}

module.exports = { callModel, loadAliveKeys, parseRetryAfterMs };