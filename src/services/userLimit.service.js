/* ═══════════════════════════════════════════════════════════════
   👥 USER LIMIT — Xử lý vượt 50 user (K1a, K1b)
   ═══════════════════════════════════════════════════════════════ */

const User = require('../models/user.model');
const { MAX_USERS } = require('../config/constants');
const logger = require('../utils/logger');

/**
 * Trước khi tạo user mới, gọi hàm này.
 * Nếu đang có >= 50 user → xóa user cũ nhất → còn 49 → tạo mới = 50.
 */
async function ensureUserSlot() {
  const count = await User.countDocuments({});

  if (count < MAX_USERS) {
    return { deleted: null };
  }

  const oldest = await User
    .findOne({})
    .sort({ createdAt: 1 })
    .lean();

  if (!oldest) return { deleted: null };

  await User.deleteOne({ _id: oldest._id });
  logger.info(`Đã xóa user cũ nhất để nhường chỗ: ${oldest.username}`);

  return { deleted: oldest };
}

module.exports = { ensureUserSlot };