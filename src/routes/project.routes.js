/* ═══════════════════════════════════════════════════════════════
   📁 PROJECT ROUTES (PJ1–PJ7)
   - Thêm GET /:id/conversations
   ═══════════════════════════════════════════════════════════════ */

const express = require('express');
const router = express.Router();

const projectController = require('../controllers/project.controller');
const { optionalAuth } = require('../middlewares/auth.middleware');
const { asyncHandler } = require('../middlewares/error.middleware');

router.use(optionalAuth);

router.get('/', asyncHandler(projectController.list));
router.post('/', asyncHandler(projectController.create));

// [MỚI] Lấy danh sách conversation của 1 dự án
router.get('/:id/conversations', asyncHandler(projectController.getConversations));

router.put('/:id', asyncHandler(projectController.rename));
router.delete('/:id', asyncHandler(projectController.remove));
router.put('/:id/move', asyncHandler(projectController.moveConversation));

module.exports = router;