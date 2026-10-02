/* ═══════════════════════════════════════════════════════════════
   💬 CHAT ROUTES
   ═══════════════════════════════════════════════════════════════ */

const express = require('express');
const router = express.Router();

const chatController = require('../controllers/chat.controller');
const { optionalAuth } = require('../middlewares/auth.middleware');
const { asyncHandler } = require('../middlewares/error.middleware');

router.use(optionalAuth);

router.post('/send', asyncHandler(chatController.send));
router.get('/:conversationId/history', asyncHandler(chatController.history));
router.delete('/:conversationId', asyncHandler(chatController.removeConversation));

module.exports = router;