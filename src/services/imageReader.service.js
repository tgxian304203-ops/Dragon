/* ═══════════════════════════════════════════════════════════════
   🖼️ IMAGE READER — Gemini vision (IA4, IA5)
   ═══════════════════════════════════════════════════════════════ */

const BrainKey = require('../models/brainKey.model');
const gemini = require('../core/providers/gemini.adapter');
const modelCache = require('../core/brains/modelCache');
const logger = require('../utils/logger');

const VISION_PRIORITY = [
  'gemini-3.8-flash',
  'gemini-3.7-flash',
  'gemini-2.5-flash',
  'gemini-3.1-flash-lite',
];

function pickVisionModel(models) {
  for (const m of VISION_PRIORITY) {
    if (models.includes(m)) return m;
  }
  return null;
}

async function docAnh({ imageBuffer, mimeType = 'image/jpeg', userId, guestSessionId }) {
  if (!imageBuffer || !Buffer.isBuffer(imageBuffer)) {
    throw new Error('Ảnh không hợp lệ');
  }

  const query = { side: 'left', provider: 'gemini', alive: true };
  if (userId) query.userId = userId;
  else if (guestSessionId) query.guestSessionId = guestSessionId;
  else throw new Error('Thiếu owner');

  const keys = await BrainKey.find(query).sort({ quotaPercent: -1 }).lean();

  if (keys.length === 0) {
    throw new Error('Não trái cần key Gemini để đọc ảnh — vui lòng thêm key Gemini');
  }

  let lastErr;
  for (const key of keys) {
    try {
      const model = pickVisionModel(key.availableModels || []);
      if (!model) throw new Error('Không có model vision khả dụng');

      const text = await gemini.readImage(key.keyValue, model, imageBuffer, mimeType);
      logger.success(`🖼️ Gemini đọc ảnh OK: ${model}`);
      return { text, provider: 'gemini', modelId: model };
    } catch (err) {
      lastErr = err;
      logger.warn(`Gemini đọc ảnh lỗi (key ${key._id}):`, err.message);

      if (/40[13]/.test(err.message)) {
        await BrainKey.updateOne({ _id: key._id }, { $set: { alive: false } });
        modelCache.clear('left', String(key._id));
      }
    }
  }

  throw new Error(`Không đọc được ảnh: ${lastErr?.message || 'không xác định'}`);
}

module.exports = { docAnh };