/* ═══════════════════════════════════════════════════════════════
   🖼️ UPLOAD CONTROLLER — Ảnh → Gemini vision (IA4–IA8)
   ═══════════════════════════════════════════════════════════════ */

const imageCache = require('../services/imageCache.service');
const imageReader = require('../services/imageReader.service');
const { generateToken } = require('../utils/helpers');
const logger = require('../utils/logger');

function getOwner(req) {
  if (req.user && req.user.userId) return { userId: req.user.userId, guestSessionId: null };
  if (req.guest && req.guest.sessionId) return { userId: null, guestSessionId: req.guest.sessionId };
  return null;
}

/* POST /api/upload */
async function uploadImage(req, res) {
  const owner = getOwner(req);
  if (!owner) return res.status(401).json({ error: 'Cần đăng nhập hoặc guest session' });
  if (!req.file) return res.status(400).json({ error: 'Chưa có file ảnh' });

  const imageId = generateToken(8);
  const buffer = req.file.buffer;
  const mimeType = req.file.mimetype || 'image/jpeg';

  imageCache.set(owner.userId, owner.guestSessionId, imageId, buffer, mimeType);

  let description;
  try {
    const result = await imageReader.docAnh({
      imageBuffer: buffer,
      mimeType,
      userId: owner.userId,
      guestSessionId: owner.guestSessionId,
    });
    description = result.text;
  } catch (err) {
    logger.error('Đọc ảnh lỗi:', err.message);
    imageCache.remove(owner.userId, owner.guestSessionId, imageId);
    return res.status(500).json({ error: err.message });
  }

  imageCache.remove(owner.userId, owner.guestSessionId, imageId);

  res.json({
    text: description,
    hasImage: true,
    imageDescription: description,
  });
}

module.exports = { uploadImage };