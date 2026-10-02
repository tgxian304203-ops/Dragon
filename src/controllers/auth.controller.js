/* ═══════════════════════════════════════════════════════════════
   🔐 AUTH CONTROLLER (AU1–AU7)
   - Register: KHÔNG auto login — user phải login lại
   ═══════════════════════════════════════════════════════════════ */

const User = require('../models/user.model');
const authService = require('../services/auth.service');
const userLimitService = require('../services/userLimit.service');
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

/* POST /api/auth/register — KHÔNG auto login */
async function register(req, res) {
  const { username, password, displayName } = req.body || {};

  if (!validator.isUsername(username)) {
    return res.status(400).json({ error: 'Username không hợp lệ (3-32 ký tự, chữ/số/_)' });
  }
  if (!validator.isPassword(password)) {
    return res.status(400).json({ error: 'Password 6-128 ký tự' });
  }

  const existing = await User.findOne({ username });
  if (existing) return res.status(409).json({ error: 'Username đã tồn tại' });

  await userLimitService.ensureUserSlot();

  const passwordHash = await authService.hashPassword(password);
  const user = await User.create({
    username, passwordHash,
    displayName: displayName || '',
  });

  logger.success(`Đăng ký thành công: ${username}`);

  res.status(201).json({
    user: user.toJSON(),
    message: 'Đăng ký thành công — vui lòng đăng nhập',
  });
}

/* POST /api/auth/login */
async function login(req, res) {
  const { username, password } = req.body || {};
  if (!username || !password) return res.status(400).json({ error: 'Thiếu username/password' });

  const user = await User.findOne({ username });
  if (!user) return res.status(401).json({ error: 'Sai username hoặc password' });

  const ok = await authService.comparePassword(password, user.passwordHash);
  if (!ok) return res.status(401).json({ error: 'Sai username hoặc password' });

  const token = authService.signToken({
    userId: user._id.toString(),
    username: user.username,
  });

  res.cookie(COOKIE_NAME, token, COOKIE_OPTS);
  logger.success(`Đăng nhập: ${username}`);

  res.json({ user: user.toJSON(), token });
}

/* POST /api/auth/logout */
async function logout(req, res) {
  res.clearCookie(COOKIE_NAME, COOKIE_OPTS);
  res.json({ success: true });
}

/* GET /api/auth/me */
async function me(req, res) {
  const user = await User.findById(req.user.userId);
  if (!user) return res.status(404).json({ error: 'Không tìm thấy user' });
  res.json({ user: user.toJSON() });
}

module.exports = { register, login, logout, me };