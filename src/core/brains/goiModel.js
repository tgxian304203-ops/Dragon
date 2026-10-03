/* ═══════════════════════════════════════════════════════════════
   📞 GỌI MODEL — KEY-FIRST đơn giản (NT9, NP9, TU7)
   - Load key của Não → sort theo quota → loop từng key
   - Mỗi key: dò model → sort priority → loop model → gọi API
   - Hết model key này → qua key tiếp
   - Hết key → báo lỗi
   ═══════════════════════════════════════════════════════════════ */

const BrainKey = require('../../models/brainKey.model');
const gemini = require('../providers/gemini.adapter');
const groq = require('../providers/groq.adapter');
const openrouter = require('../providers/openrouter.adapter');
const { sortByPriority } = require('./modelPriority');
const quotaTracker = require('./quotaTracker');
const modelCache = require('./modelCache');
const { doModel } = require('./doModel');
const logger = require('../../utils/logger');

const ADAPTERS = { gemini, groq, openrouter };

/**
 * Load tất cả key đang sống của 1 não.
 */
async function loadAliveKeys(side, userId, guestSessionId) {
  const query = { side, alive: true };
  if (userId) query.userId = userId;
  else if (guestSessionId) query.guestSessionId = guestSessionId;
  else throw new Error('Thiếu owner');

  return BrainKey.find(query).lean();
}

/**
 * Đảm bảo key có danh sách model. Dùng cache → DB → dò mới.
 */
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
    logger.warn(`Không dò được model cho key ${keyIdStr} (${key.provider}): ${err.message}`);
    return [];
  }
}

/**
 * Gọi model theo cơ chế KEY-FIRST.
 */
async function callModel({ side, userId, guestSessionId, messages, options = {} }) {
  if (!['left', 'right'].includes(side)) {
    throw new Error('side phải là left/right');
  }

  const excludeModels = new Set(
    Array.isArray(options.excludeModels) ? options.excludeModels : []
  );

  // ═══ BƯỚC 1 — Load key ═══
  const keys = await loadAliveKeys(side, userId, guestSessionId);
  if (keys.length === 0) {
    throw new Error(`Não ${side === 'left' ? 'trái' : 'phải'} chưa có key nào hoạt động`);
  }

  // ═══ BƯỚC 2 — Gắn quota hiệu dụng + sort key (khỏe trước) ═══
  for (const k of keys) {
    k._quotaHieuDung = quotaTracker.layQuotaHieuDung(k);
  }
  keys.sort((a, b) => b._quotaHieuDung - a._quotaHieuDung);

  logger.info(
    `🎯 Não ${side === 'left' ? 'trái' : 'phải'} — ${keys.length} key: ` +
    keys.map((k) => `${k.provider}(${k._quotaHieuDung}%)`).join(' → ')
  );

  const lastErrors = [];

  // ═══ BƯỚC 3 — Loop từng key ═══
  for (let ki = 0; ki < keys.length; ki++) {
    const key = keys[ki];
    const keyIdStr = String(key._id);
    const provider = key.provider;
    const adapter = ADAPTERS[provider];

    if (!adapter) {
      logger.warn(`Key ${keyIdStr}: provider ${provider} không hỗ trợ`);
      continue;
    }

    // ═══ BƯỚC 4 — Dò model cho key này ═══
    const rawModels = await ensureModels(side, key);
    if (!rawModels || rawModels.length === 0) {
      logger.warn(`⚠️ Key ${provider} (${keyIdStr}) không có model → qua key tiếp`);
      continue;
    }

    // ═══ BƯỚC 5 — Sort model theo priority + bỏ blacklist ═══
    const sortedModels = sortByPriority(provider, rawModels).filter(
      (m) => !excludeModels.has(m)
    );

    if (sortedModels.length === 0) {
      logger.warn(`⚠️ Key ${provider} (${keyIdStr}) hết model khả dụng → qua key tiếp`);
      continue;
    }

    logger.debug(
      `🔑 Key ${provider} (${keyIdStr}) — quota=${key._quotaHieuDung}%, ` +
      `${sortedModels.length} model: ${sortedModels.slice(0, 3).join(', ')}...`
    );

    // ═══ BƯỚC 6 — Loop từng model của key này ═══
    for (const modelId of sortedModels) {
      try {
        logger.debug(`→ Gọi ${provider}/${modelId} (key ${keyIdStr})`);

        const result = await adapter.chat(
          key.keyValue,
          modelId,
          messages,
          options
        );

        if (result.rateLimit) {
          await quotaTracker.updateQuota(key._id, result.rateLimit);
        }

        logger.success(`Gọi OK: ${provider}/${modelId}`);

        return {
          text: result.text,
          usage: result.usage || {},
          provider,
          modelId,
          keyId: key._id,
        };
      } catch (err) {
        const status = err.status;
        logger.warn(`Lỗi ${provider}/${modelId} (key ${keyIdStr}): ${err.message}`);
        lastErrors.push(`${provider}/${modelId}: ${err.message}`);

        // 401/403 — key chết → đánh dấu + thoát khỏi key này
        if (status === 401 || status === 403) {
          await BrainKey.updateOne({ _id: key._id }, { $set: { alive: false } });
          modelCache.clear(side, keyIdStr);
          logger.warn(`☠️ Key ${provider} (${keyIdStr}) chết → bỏ qua`);
          break;
        }

        // 429 — hết quota → đánh dấu + thoát khỏi key này
        if (status === 429) {
          await quotaTracker.markExhausted(key._id);
          logger.warn(`🔋 Key ${provider} (${keyIdStr}) hết quota → qua key tiếp`);
          break;
        }

        // 400 — request sai → thử model khác
        // Các lỗi khác — thử model khác
        continue;
      }
    }

    // ═══ BƯỚC 7 — Hết model key này → log + qua key tiếp ═══
    const nextKey = keys[ki + 1];
    if (nextKey) {
      logger.warn(`⚠️ Key ${provider} hết model → qua key ${nextKey.provider}`);
    } else {
      logger.warn(`⚠️ Key ${provider} hết model — không còn key nào`);
    }
  }

  // ═══ BƯỚC 8 — Hết key ═══
  throw new Error(
    `Não ${side === 'left' ? 'trái' : 'phải'}: tất cả key thất bại (${keys.length} key). ` +
    `Chi tiết: ${lastErrors.slice(-5).join(' | ')}`
  );
}

module.exports = { callModel, loadAliveKeys };