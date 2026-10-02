/* ═══════════════════════════════════════════════════════════════
   🥷 GUEST CONTROLLER
   ═══════════════════════════════════════════════════════════════ */

const guestService = require('../services/guest.service');
const authService = require('../services/auth.service');
const userLimitService = require('../services/userLimit.service');
const User = require('../models/user.model');
const validator = require('../utils/validator');
const logger = require('../utils/logger');

const COOKIE_NAME = 'token';
const COOKIE_OPTS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax',
  maxAge: 1000 * 60 * 60 * 24 * 365 * 10,
  path: '/',
};

/* POST /api/guest/create */
async function createGuest(req, res) {
  if (req.user && req.user.userId) {
    return res.status(400).json({ error: 'Đã đăng nhập — không cần tạo guest session' });
  }

  const existingToken = req.headers['x-guest-token'];
  if (existingToken) {
    const existing = await guestService.findGuestSession(existingToken);
    if (existing && !existing.isConverted) {
      return res.json({
        sessionToken: existing.sessionToken,
        isConverted: false,
        createdAt: existing.createdAt,
      });
    }
  }

  const session = await guestService.createGuestSession();

  logger.info(`Guest session: ${session.sessionToken.slice(0, 8)}...`);

  res.status(201).json({
    sessionToken: session.sessionToken,
    isConverted: false,
    createdAt: session.createdAt,
  });
}

/* POST /api/guest/convert */
async function convertGuest(req, res) {
  if (req.user && req.user.userId) {
    return res.status(400).json({ error: 'Đã đăng nhập — không cần chuyển đổi' });
  }

  const { sessionToken, username, password, displayName } = req.body || {};

  if (!sessionToken) return res.status(400).json({ error: 'Thiếu sessionToken' });
  if (!validator.isUsername(username)) return res.status(400).json({ error: 'Username không hợp lệ' });
  if (!validator.isPassword(password)) return res.status(400).json({ error: 'Password 6-128 ký tự' });

  const session = await guestService.findGuestSession(sessionToken);
  if (!session) return res.status(404).json({ error: 'Session không tồn tại' });
  if (session.isConverted) return res.status(409).json({ error: 'Session đã được chuyển' });

  const existing = await User.findOne({ username });
  if (existing) return res.status(409).json({ error: 'Username đã tồn tại' });

  await userLimitService.ensureUserSlot();

  const passwordHash = await authService.hashPassword(password);
  const user = await User.create({
    username, passwordHash,
    displayName: displayName || '',
  });

  const result = await guestService.convertGuestToAccount(sessionToken, user._id);

  const token = authService.signToken({
    userId: user._id.toString(),
    username: user.username,
  });

  res.cookie(COOKIE_NAME, token, COOKIE_OPTS);
  logger.success(`Guest → Account: ${username}`);

  res.json({
    user: user.toJSON(),
    token,
    migrated: result.migrated,
  });
}

module.exports = { createGuest, convertGuest };