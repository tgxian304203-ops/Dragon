/* ═══════════════════════════════════════════════════════════════
   🎤 VOICE READER — Groq Whisper (VO9, VO10)
   ═══════════════════════════════════════════════════════════════ */

const BrainKey = require('../models/brainKey.model');
const groq = require('../core/providers/groq.adapter');
const modelCache = require('../core/brains/modelCache');
const logger = require('../utils/logger');

async function sttVoice({ audioBuffer, userId, guestSessionId, filename = 'voice.webm' }) {
  if (!audioBuffer || !Buffer.isBuffer(audioBuffer)) {
    throw new Error('Voice không hợp lệ');
  }

  const query = { side: 'left', provider: 'groq', alive: true };
  if (userId) query.userId = userId;
  else if (guestSessionId) query.guestSessionId = guestSessionId;
  else throw new Error('Thiếu owner');

  const keys = await BrainKey.find(query).sort({ quotaPercent: -1 }).lean();

  if (keys.length === 0) {
    throw new Error('Não trái cần key Groq để dùng voice — vui lòng thêm key Groq');
  }

  let lastErr;
  for (const key of keys) {
    try {
      const result = await groq.transcribe(key.keyValue, audioBuffer, filename);
      logger.success('🎤 Groq Whisper OK');
      return { text: result.text, provider: 'groq' };
    } catch (err) {
      lastErr = err;
      logger.warn(`Groq Whisper lỗi (key ${key._id}):`, err.message);

      if (/40[13]/.test(err.message)) {
        await BrainKey.updateOne({ _id: key._id }, { $set: { alive: false } });
        modelCache.clear('left', String(key._id));
      }
    }
  }

  throw new Error(`Không chuyển được voice: ${lastErr?.message || 'không xác định'}`);
}

module.exports = { sttVoice };