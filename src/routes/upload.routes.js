/* ═══════════════════════════════════════════════════════════════
   🖼️ UPLOAD ROUTES — chỉ ảnh (file → /api/file)
   ═══════════════════════════════════════════════════════════════ */

const express = require('express');
const router = express.Router();

const uploadController = require('../controllers/upload.controller');
const { uploadImage } = require('../services/upload.service');
const { optionalAuth } = require('../middlewares/auth.middleware');
const { asyncHandler } = require('../middlewares/error.middleware');

router.post('/', optionalAuth, uploadImage, asyncHandler(uploadController.uploadImage));

module.exports = router;