/* ═══════════════════════════════════════════════════════════════
   📁 FILE CONTROLLER (FL1–FL15)
   ═══════════════════════════════════════════════════════════════ */

const fileCache = require('../services/fileCache.service');
const fileReader = require('../services/fileReader.service');
const { generateToken } = require('../utils/helpers');
const logger = require('../utils/logger');

function getOwner(req) {
  if (req.user && req.user.userId) return { userId: req.user.userId, guestSessionId: null };
  if (req.guest && req.guest.sessionId) return { userId: null, guestSessionId: req.guest.sessionId };
  return null;
}

/* POST /api/file */
async function upload(req, res) {
  const owner = getOwner(req);
  if (!owner) return res.status(401).json({ error: 'Cần đăng nhập hoặc guest session' });
  if (!req.file) return res.status(400).json({ error: 'Chưa có file' });

  const fileId = generateToken(8);
  const buffer = req.file.buffer;
  const fileName = req.file.originalname || 'file';
  const mimeType = req.file.mimetype || 'application/octet-stream';
  const fileType = fileName.split('.').pop() || '';

  try {
    fileCache.set(owner.userId, owner.guestSessionId, fileId, buffer, {
      fileName, mimeType, fileType,
    });
  } catch (err) {
    return res.status(503).json({ error: err.message });
  }

  let text;
  try {
    const result = await fileReader.docFile({
      fileBuffer: buffer,
      mimeType,
      userId: owner.userId,
      guestSessionId: owner.guestSessionId,
    });
    text = result.text;
  } catch (err) {
    logger.error('Đọc file lỗi:', err.message);
    return res.status(500).json({ error: err.message, fileId });
  }

  fileCache.remove(owner.userId, owner.guestSessionId, fileId);

  res.json({
    text,
    hasFile: true,
    fileName,
    fileType,
    fileText: text,
  });
}

module.exports = { upload };