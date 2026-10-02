/* ═══════════════════════════════════════════════════════════════
   🎤 VOICE ROUTES (VO1–VO18)
   ═══════════════════════════════════════════════════════════════ */

const express = require('express');
const router = express.Router();

const voiceController = require('../controllers/voice.controller');
const { uploadVoice } = require('../services/upload.service');
const { optionalAuth } = require('../middlewares/auth.middleware');
const { asyncHandler } = require('../middlewares/error.middleware');

router.post('/', optionalAuth, uploadVoice, asyncHandler(voiceController.transcribe));

module.exports = router;