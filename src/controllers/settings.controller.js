/* ═══════════════════════════════════════════════════════════════
   ⚙️ SETTINGS CONTROLLER (ST1–ST4)
   ═══════════════════════════════════════════════════════════════ */

const User = require('../models/user.model');
const authService = require('../services/auth.service');
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

/* PUT /api/settings/password — ST1 */
async function changePassword(req, res) {
  const { oldPassword, newPassword } = req.body || {};

  if (!validator.isPassword(newPassword)) {
    return res.status(400).json({ error: 'Password mới 6-128 ký tự' });
  }

  const user = await User.findById(req.user.userId);
  if (!user) return res.status(404).json({ error: 'Không tìm thấy user' });

  const ok = await authService.comparePassword(oldPassword, user.passwordHash);
  if (!ok) return res.status(401).json({ error: 'Mật khẩu cũ sai' });

  user.passwordHash = await authService.hashPassword(newPassword);
  await user.save();

  res.clearCookie(COOKIE_NAME, COOKIE_OPTS);

  logger.success(`Đổi mật khẩu: ${user.username}`);
  res.json({ success: true, message: 'Đã đổi mật khẩu — vui lòng đăng nhập lại' });
}

/* DELETE /api/settings/account — ST2 */
async function deleteAccount(req, res) {
  const user = await User.findById(req.user.userId);
  if (!user) return res.status(404).json({ error: 'Không tìm thấy user' });

  await User.deleteOne({ _id: user._id });
  res.clearCookie(COOKIE_NAME, COOKIE_OPTS);

  logger.info(`Xóa tài khoản: ${user.username}`);
  res.json({ success: true });
}

/* GET /api/settings — ST3, ST4 */
async function get(req, res) {
  const user = await User.findById(req.user.userId);
  if (!user) return res.status(404).json({ error: 'Không tìm thấy user' });

  res.json({
    settings: {
      preferredModel: null,
      language: 'vi',
    },
  });
}

module.exports = { changePassword, deleteAccount, get };