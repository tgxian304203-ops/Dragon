/* ═══════════════════════════════════════════════════════════════
   🔑 BRAIN ROUTES
   - GET: optional (guest xem rỗng)
   - POST/DELETE: requireAuth (chỉ user login)
   ═══════════════════════════════════════════════════════════════ */

const express = require('express');
const router = express.Router();

const brainController = require('../controllers/brain.controller');
const { requireAuth, optionalAuth } = require('../middlewares/auth.middleware');
const { asyncHandler } = require('../middlewares/error.middleware');

router.get('/run', optionalAuth, asyncHandler(brainController.listKeys));
router.post('/key', requireAuth, asyncHandler(brainController.addKey));
router.delete('/key/:id', requireAuth, asyncHandler(brainController.deleteKey));

module.exports = router;