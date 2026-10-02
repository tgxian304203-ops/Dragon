/* ═══════════════════════════════════════════════════════════════
   📁 FILE ROUTES (FL1–FL15)
   ═══════════════════════════════════════════════════════════════ */

const express = require('express');
const router = express.Router();

const fileController = require('../controllers/file.controller');
const { uploadAny } = require('../services/upload.service');
const { optionalAuth } = require('../middlewares/auth.middleware');
const { asyncHandler } = require('../middlewares/error.middleware');

router.post('/', optionalAuth, uploadAny, asyncHandler(fileController.upload));

module.exports = router;