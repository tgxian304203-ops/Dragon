/* ═══════════════════════════════════════════════════════════════
   🔄 AUTO UPDATE MODELS (TU6)
   ═══════════════════════════════════════════════════════════════ */

const BrainKey = require('../../models/brainKey.model');
const { doModel } = require('./doModel');
const modelCache = require('./modelCache');
const { MODEL_UPDATE_INTERVAL_MS } = require('../../config/constants');
const logger = require('../../utils/logger');

let timer = null;
let isRunning = false;

async function updateAllKeys() {
  if (isRunning) return;
  isRunning = true;
  const start = Date.now();

  try {
    const keys = await BrainKey.find({ alive: true }).lean();
    logger.info(`🔄 Auto update: ${keys.length} key`);

    let updated = 0;
    let failed = 0;

    for (const key of keys) {
      const exists = await BrainKey.exists({ _id: key._id });
      if (!exists) continue;

      try {
        const { models } = await doModel(key.provider, key.keyValue);
        await BrainKey.updateOne({ _id: key._id }, { $set: { availableModels: models } });
        modelCache.set(key.side, String(key._id), models);
        updated++;
      } catch (err) {
        failed++;
        logger.warn(`Update key ${key._id} fail:`, err.message);

        if (/40[13]/.test(err.message)) {
          await BrainKey.updateOne({ _id: key._id }, { $set: { alive: false } });
          modelCache.clear(key.side, String(key._id));
        }
      }
    }

    logger.success(`Auto update xong: ${updated} OK, ${failed} lỗi (${Date.now() - start}ms)`);
  } catch (err) {
    logger.error('Auto update lỗi:', err.message);
  } finally {
    isRunning = false;
  }
}

function startAutoUpdate() {
  if (timer) return;

  setTimeout(() => {
    updateAllKeys().catch((err) => logger.error('Auto update đầu tiên lỗi:', err.message));
  }, 5000);

  timer = setInterval(() => {
    updateAllKeys().catch((err) => logger.error('Auto update định kỳ lỗi:', err.message));
  }, MODEL_UPDATE_INTERVAL_MS);

  logger.info(`🔄 Auto update bật — mỗi ${MODEL_UPDATE_INTERVAL_MS / 1000 / 60 / 60}h`);
}

function stopAutoUpdate() {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
}

module.exports = { startAutoUpdate, stopAutoUpdate, updateAllKeys };