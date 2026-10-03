/* ═══════════════════════════════════════════════════════════════
   📞 GỌI MODEL — fallback tự động (NT9, NP9, TU7)
   - Sort key theo quota (chỉ ưu tiên, KHÔNG skip)
   - Fallback xuyên provider: provider đầu fail hết → chuyển provider tiếp
   - Nhận options.excludeModels để blacklist model lỗi
   ═══════════════════════════════════════════════════════════════ */

const BrainKey = require('../../models/brainKey.model');
const gemini = require('../providers/gemini.adapter');
const groq = require('../providers/groq.adapter');
const openrouter = require('../providers/openrouter.adapter');
const { pickNextModel, groupKeysByProvider, getProviderOrder } = require('./chonModel');
const quotaTracker = require('./quotaTracker');
const modelCache = require('./modelCache');
const { doModel } = require('./doModel');
const logger = require('../../utils/logger');

const ADAPTERS = { gemini, groq, openrouter };

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
  if (cached) return cached;

  if (key.availableModels && key.availableModels.length > 0) {
    modelCache.set(side, keyIdStr, key.availableModels);
    return key.availableModels;
  }

  try {
    const { models } = await doModel(key.provider, key.keyValue);
    modelCache.set(side, keyIdStr, models);
    await BrainKey.updateOne({ _id: key._id }, { $set: { availableModels: models } });
    return models;
  } catch (err) {
    logger.warn(`Không dò được model cho key ${keyIdStr}:`, err.message);
    return [];
  }
}

async function callModel({ side, userId, guestSessionId, messages, options = {} }) {
  if (!['left', 'right'].includes(side)) throw new Error('side phải là left/right');

  const excludeModels = new Set(
    Array.isArray(options.excludeModels) ? options.excludeModels : []
  );

  const keys = await loadAliveKeys(side, userId, guestSessionId);
  if (keys.length === 0) {
    throw new Error(`Não ${side === 'left' ? 'trái' : 'phải'} chưa có key nào hoạt động`);
  }

  for (const key of keys) {
    await ensureModels(side, key);
  }

  const keysWithModels = await BrainKey.find({
    _id: { $in: keys.map((k) => k._id) },
    alive: true,
  }).lean();

  // Sort key theo quota (chỉ ưu tiên, KHÔNG skip)
  for (const k of keysWithModels) {
    k._quotaHieuDung = quotaTracker.layQuotaHieuDung(k);
  }
  keysWithModels.sort((a, b) => b._quotaHieuDung - a._quotaHieuDung);

  const keysByProvider = groupKeysByProvider(keysWithModels);
  const providerOrder = getProviderOrder(keysByProvider, quotaTracker);

  if (providerOrder.length === 0) {
    throw new Error(`Không có key ${side} nào có model khả dụng`);
  }

  logger.info(`🎯 Provider order: ${providerOrder.join(' → ')}`);

  const triedKeys = new Set();
  const lastErrors = [];

  for (let pi = 0; pi < providerOrder.length; pi++) {
    const provider = providerOrder[pi];
    const providerKeys = keysByProvider[provider];
    const triedModelsInProvider = new Set(); // [MỚI] reset cho mỗi provider

    let providerHadAttempt = false;
    let providerSuccess = false;

    while (true) {
      const picked = pickNextModel(provider, providerKeys, triedModelsInProvider);
      if (!picked) break;

      const { modelId, keys: keyCandidates } = picked;
      triedModelsInProvider.add(modelId);
      providerHadAttempt = true;

      for (const keyInfo of keyCandidates) {
        const keyIdStr = String(keyInfo.keyId);
        if (triedKeys.has(`${keyIdStr}:${modelId}`)) continue;

        const keyData = keysWithModels.find((k) => String(k._id) === keyIdStr);
        if (!keyData) continue;

        try {
          logger.debug(`Gọi ${provider}/${modelId} với key ${keyIdStr}`);

          const result = await ADAPTERS[provider].chat(
            keyData.keyValue, modelId, messages, options
          );

          if (result.rateLimit) {
            await quotaTracker.updateQuota(keyInfo.keyId, result.rateLimit);
          }

          logger.success(`Gọi OK: ${provider}/${modelId}`);

          return {
            text: result.text,
            usage: result.usage || {},
            provider,
            modelId,
            keyId: keyInfo.keyId,
          };
        } catch (err) {
          triedKeys.add(`${keyIdStr}:${modelId}`);
          const status = err.status;

          logger.warn(`Lỗi ${provider}/${modelId} (key ${keyIdStr}): ${err.message}`);
          lastErrors.push(`${provider}/${modelId}: ${err.message}`);

          if (status === 401 || status === 403) {
            await BrainKey.updateOne({ _id: keyInfo.keyId }, { $set: { alive: false } });
            modelCache.clear(side, keyIdStr);
          }

          if (status === 429) {
            await quotaTracker.markExhausted(keyInfo.keyId);
          }

          if (status === 400) break;
          continue;
        }
      }
    }

    // [MỚI] Log rõ khi provider fail hết
    if (providerHadAttempt && !providerSuccess) {
      const nextProvider = providerOrder[pi + 1];
      if (nextProvider) {
        logger.warn(`⚠️ Provider ${provider} fail hết model → chuyển sang ${nextProvider}`);
      } else {
        logger.warn(`⚠️ Provider ${provider} fail hết model — không còn provider nào`);
      }
    }
  }

  throw new Error(
    `Não ${side === 'left' ? 'trái' : 'phải'}: tất cả model thất bại. ` +
    `Chi tiết: ${lastErrors.slice(-5).join(' | ')}`
  );
}

module.exports = { callModel, loadAliveKeys };