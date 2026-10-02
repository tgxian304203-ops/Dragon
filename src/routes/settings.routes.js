/* ═══════════════════════════════════════════════════════════════
   ⚙️ SETTINGS ROUTES (ST1–ST4)
   ═══════════════════════════════════════════════════════════════ */

const express = require('express');
const router = express.Router();

const settingsController = require('../controllers/settings.controller');
const { requireAuth } = require('../middlewares/auth.middleware');
const { asyncHandler } = require('../middlewares/error.middleware');

router.use(requireAuth);

router.get('/', asyncHandler(settingsController.get));
router.put('/password', asyncHandler(settingsController.changePassword));
router.delete('/account', asyncHandler(settingsController.deleteAccount));

module.exports = router;