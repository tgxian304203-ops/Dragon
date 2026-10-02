/* ═══════════════════════════════════════════════════════════════
   🥷 GUEST ROUTES
   ═══════════════════════════════════════════════════════════════ */

const express = require('express');
const router = express.Router();

const guestController = require('../controllers/guest.controller');
const { optionalAuth } = require('../middlewares/auth.middleware');
const { asyncHandler } = require('../middlewares/error.middleware');

router.post('/create', asyncHandler(guestController.createGuest));
router.post('/convert', optionalAuth, asyncHandler(guestController.convertGuest));

module.exports = router;