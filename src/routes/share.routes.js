/* ═══════════════════════════════════════════════════════════════
   🔗 SHARE ROUTES (SH1–SH6)
   ═══════════════════════════════════════════════════════════════ */

const express = require('express');
const router = express.Router();

const shareController = require('../controllers/share.controller');
const { optionalAuth } = require('../middlewares/auth.middleware');
const { asyncHandler } = require('../middlewares/error.middleware');

router.get('/view/:slug', asyncHandler(shareController.view));

router.get('/', optionalAuth, asyncHandler(shareController.list));
router.post('/', optionalAuth, asyncHandler(shareController.create));
router.delete('/:conversationId', optionalAuth, asyncHandler(shareController.remove));

module.exports = router;