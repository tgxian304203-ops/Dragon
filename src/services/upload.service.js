/* ═══════════════════════════════════════════════════════════════
   📎 UPLOAD SERVICE — Multer memoryStorage (FL/IA/VO)
   ═══════════════════════════════════════════════════════════════ */

const multer = require('multer');
const { MAX_VOICE_SIZE_BYTES } = require('../config/constants');

const memoryStorage = multer.memoryStorage();

const uploadAny = multer({
  storage: memoryStorage,
  limits: { fileSize: 50 * 1024 * 1024 },
}).single('file');

const uploadVoice = multer({
  storage: memoryStorage,
  limits: { fileSize: MAX_VOICE_SIZE_BYTES },
}).single('audio');

const uploadImage = multer({
  storage: memoryStorage,
  limits: { fileSize: 20 * 1024 * 1024 },
}).single('file');

module.exports = { uploadAny, uploadVoice, uploadImage };