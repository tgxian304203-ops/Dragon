/* ═══════════════════════════════════════════════════════════════
   📁 PROJECT ROUTES (PJ1–PJ6)
   ═══════════════════════════════════════════════════════════════ */

const express = require('express');
const router = express.Router();

const projectController = require('../controllers/project.controller');
const { optionalAuth } = require('../middlewares/auth.middleware');
const { asyncHandler } = require('../middlewares/error.middleware');

router.use(optionalAuth);

router.get('/', asyncHandler(projectController.list));
router.post('/', asyncHandler(projectController.create));
router.put('/:id', asyncHandler(projectController.rename));
router.delete('/:id', asyncHandler(projectController.remove));
router.put('/:id/move', asyncHandler(projectController.moveConversation));

module.exports = router;