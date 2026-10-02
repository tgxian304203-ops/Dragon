/* ═══════════════════════════════════════════════════════════════
   🕐 RECENT ROUTES (RC1–RC3)
   ═══════════════════════════════════════════════════════════════ */

const express = require('express');
const router = express.Router();

const recentController = require('../controllers/recent.controller');
const { optionalAuth } = require('../middlewares/auth.middleware');
const { asyncHandler } = require('../middlewares/error.middleware');

router.get('/', optionalAuth, asyncHandler(recentController.list));

module.exports = router;