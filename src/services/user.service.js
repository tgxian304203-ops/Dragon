/* ═══════════════════════════════════════════════════════════════
   👤 USER SERVICE
   - Lưu/đọc User Profile
   - Auto-learn từ hành vi user
   ═══════════════════════════════════════════════════════════════ */

const User = require('../models/user.model');
const logger = require('../utils/logger');

/**
 * Lấy profile user (chỉ những field cần thiết).
 */
async function getProfile(userId) {
  if (!userId) return null;
  try {
    const user = await User.findById(userId).select('profile').lean();
    return user?.profile || null;
  } catch (err) {
    logger.warn(`getProfile lỗi: ${err.message}`);
    return null;
  }
}

/**
 * Cập nhật profile user — chỉ những field được truyền.
 */
async function updateProfile(userId, updates) {
  if (!userId || !updates || typeof updates !== 'object') return null;

  const setObj = {};
  const allowed = [
    'preferredLang', 'techStack', 'commonProjects',
    'skillLevel', 'preferredEditor', 'timezone', 'lastActiveAt',
  ];

  for (const key of allowed) {
    if (updates[key] !== undefined) {
      setObj[`profile.${key}`] = updates[key];
    }
  }

  if (Object.keys(setObj).length === 0) return null;

  try {
    await User.updateOne({ _id: userId }, { $set: setObj });
    return await getProfile(userId);
  } catch (err) {
    logger.warn(`updateProfile lỗi: ${err.message}`);
    return null;
  }
}

/**
 * [MỚI] Auto-learn từ hành vi user.
 * Gọi sau mỗi tin nhắn user → cập nhật profile dựa trên:
 * - Ngôn ngữ user hay dùng
 * - Loại dự án user hay làm
 * - Editor user hay dùng
 */
async function autoLearn(userId, signals = {}) {
  if (!userId) return null;

  const { lang, projectType, editor } = signals;
  const updates = { lastActiveAt: new Date() };

  try {
    const current = await getProfile(userId);
    if (!current) return null;

    // Ưu tiên lang mới nếu có
    if (lang && lang !== current.preferredLang) {
      // Chỉ cập nhật nếu user dùng lang đó ≥ 2 lần gần đây (đơn giản hóa: cập nhật luôn)
      updates.preferredLang = lang;
    }

    // Thêm vào techStack nếu chưa có
    if (lang && !(current.techStack || []).includes(lang)) {
      updates.techStack = [...(current.techStack || []), lang].slice(-10);
    }

    // Thêm vào commonProjects
    if (projectType && !(current.commonProjects || []).includes(projectType)) {
      updates.commonProjects = [...(current.commonProjects || []), projectType].slice(-10);
    }

    // Editor
    if (editor && editor !== current.preferredEditor) {
      updates.preferredEditor = editor;
    }

    return await updateProfile(userId, updates);
  } catch (err) {
    logger.warn(`autoLearn lỗi: ${err.message}`);
    return null;
  }
}

module.exports = { getProfile, updateProfile, autoLearn };