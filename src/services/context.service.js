/* ═══════════════════════════════════════════════════════════════
   🧠 CONTEXT SERVICE
   - Lưu/đọc Context + mở rộng
   - [SỬA] Dùng findOneAndUpdate — tránh version conflict
   ═══════════════════════════════════════════════════════════════ */

const Context = require('../models/context.model');
const logger = require('../utils/logger');

const FIELDS_14 = [
  'nguyenLy', 'quyTac', 'dieuKien', 'cayQuyetDinh',
  'phuongPhap', 'thuatToan', 'workflow', 'suyLuan',
  'testCase', 'kiemChung', 'ngoaiLe', 'caseKinhNghiem',
  'quanHe', 'nguonPhienBan',
];

async function getContext(conversationId) {
  if (!conversationId) return null;
  try {
    return await Context.findOne({ conversationId }).sort({ createdAt: -1 }).lean();
  } catch (err) {
    logger.warn(`getContext lỗi: ${err.message}`);
    return null;
  }
}

/**
 * [SỬA] Dùng findOneAndUpdate để tránh version conflict.
 */
async function saveContext(data) {
  if (!data || !data.conversationId) {
    logger.warn('saveContext: thiếu conversationId');
    return null;
  }

  try {
    const payload = {};
    for (const field of FIELDS_14) {
      if (data[field] !== undefined) payload[field] = data[field];
    }
    if (data.category !== undefined) payload.category = data.category;
    if (data.keywords !== undefined) payload.keywords = data.keywords;
    if (data.intentHistory !== undefined) payload.intentHistory = data.intentHistory;
    if (data.userProfileSnapshot !== undefined) payload.userProfileSnapshot = data.userProfileSnapshot;
    if (data.extendedContext !== undefined) payload.extendedContext = data.extendedContext;

    const result = await Context.findOneAndUpdate(
      { conversationId: data.conversationId },
      {
        $set: {
          ...payload,
          userId: data.userId || null,
          guestSessionId: data.guestSessionId || null,
        },
        $setOnInsert: { conversationId: data.conversationId },
      },
      { new: true, upsert: true, setDefaultsOnInsert: true, lean: true }
    );

    return result;
  } catch (err) {
    logger.warn(`saveContext lỗi: ${err.message}`);
    return null;
  }
}

/**
 * Ghi intent vào lịch sử (giữ tối đa 50 phần tử).
 * Dùng atomic $push + $slice để tránh version conflict.
 */
async function pushIntent(conversationId, intent) {
  if (!conversationId || !intent) return null;
  try {
    const result = await Context.findOneAndUpdate(
      { conversationId },
      {
        $push: {
          intentHistory: {
            $each: [intent],
            $slice: -50,
          },
        },
      },
      { new: true, lean: true }
    );
    return result?.intentHistory || null;
  } catch (err) {
    logger.warn(`pushIntent lỗi: ${err.message}`);
    return null;
  }
}

module.exports = { getContext, saveContext, pushIntent, FIELDS_14 };