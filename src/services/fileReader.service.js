/* ═══════════════════════════════════════════════════════════════
   📁 FILE READER — Gemini đọc file (FL6, FL7)
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

async function docFile({ fileBuffer, mimeType, userId, guestSessionId }) {
  if (!fileBuffer || !Buffer.isBuffer(fileBuffer)) {
    throw new Error('File không hợp lệ');
  }

  const query = { side: 'left', provider: 'gemini', alive: true };
  if (userId) query.userId = userId;
  else if (guestSessionId) query.guestSessionId = guestSessionId;
  else throw new Error('Thiếu owner');

  const keys = await BrainKey.find(query).sort({ quotaPercent: -1 }).lean();

  if (keys.length === 0) {
    throw new Error('Não trái cần key Gemini để đọc file — vui lòng thêm key Gemini');
  }

  let lastErr;
  for (const key of keys) {
    try {
      const model = pickVisionModel(key.availableModels || []);
      if (!model) throw new Error('Không có model khả dụng');

      const text = await gemini.readFile(key.keyValue, model, fileBuffer, mimeType);
      logger.success(`📁 Gemini đọc file OK: ${model}`);
      return { text, provider: 'gemini', modelId: model };
    } catch (err) {
      lastErr = err;
      logger.warn(`Gemini đọc file lỗi (key ${key._id}):`, err.message);

      if (/40[13]/.test(err.message)) {
        await BrainKey.updateOne({ _id: key._id }, { $set: { alive: false } });
        modelCache.clear('left', String(key._id));
      }
    }
  }

  throw new Error(`Không đọc được file: ${lastErr?.message || 'không xác định'}`);
}

module.exports = { docFile };