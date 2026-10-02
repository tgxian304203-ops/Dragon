/* ═══════════════════════════════════════════════════════════════
   🎤 VOICE CONTROLLER (VO1–VO18)
   ═══════════════════════════════════════════════════════════════ */

const voiceCache = require('../services/voiceCache.service');
const voiceReader = require('../services/voiceReader.service');
const { generateToken } = require('../utils/helpers');
const logger = require('../utils/logger');

function getOwner(req) {
  if (req.user && req.user.userId) return { userId: req.user.userId, guestSessionId: null };
  if (req.guest && req.guest.sessionId) return { userId: null, guestSessionId: req.guest.sessionId };
  return null;
}

/* POST /api/voice */
async function transcribe(req, res) {
  const owner = getOwner(req);
  if (!owner) return res.status(401).json({ error: 'Cần đăng nhập hoặc guest session' });
  if (!req.file) return res.status(400).json({ error: 'Chưa có audio' });

  const buffer = req.file.buffer;
  const voiceId = generateToken(8);

  voiceCache.set(owner.userId, owner.guestSessionId, voiceId, buffer, req.file.mimetype || 'audio/webm');

  let text;
  try {
    const result = await voiceReader.sttVoice({
      audioBuffer: buffer,
      userId: owner.userId,
      guestSessionId: owner.guestSessionId,
      filename: req.file.originalname || 'voice.webm',
    });
    text = result.text;
  } catch (err) {
    logger.error('STT lỗi:', err.message);
    return res.status(500).json({ error: err.message, voiceId });
  }

  voiceCache.remove(owner.userId, owner.guestSessionId, voiceId);

  res.json({ text, hasVoice: true });
}

module.exports = { transcribe };