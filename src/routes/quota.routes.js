/* ═══════════════════════════════════════════════════════════════
   📊 QUOTA ROUTES (MR10)
   ═══════════════════════════════════════════════════════════════ */

const express = require('express');
const router = express.Router();

const quotaController = require('../controllers/quota.controller');
const { optionalAuth } = require('../middlewares/auth.middleware');
const { asyncHandler } = require('../middlewares/error.middleware');

router.get('/', optionalAuth, asyncHandler(quotaController.get));

module.exports = router;