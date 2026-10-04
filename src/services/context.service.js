/* ═══════════════════════════════════════════════════════════════
   🧠 CONTEXT SERVICE
   - Lưu/đọc Context + mở rộng (intentHistory, userProfileSnapshot)
   ═══════════════════════════════════════════════════════════════ */

const Context = require('../models/context.model');
const logger = require('../utils/logger');

const FIELDS_14 = [
  'nguyenLy', 'quyTac', 'dieuKien', 'cayQuyetDinh',
  'phuongPhap', 'thuatToan', 'workflow', 'suyLuan',
  'testCase', 'kiemChung', 'ngoaiLe', 'caseKinhNghiem',
  'quanHe', 'nguonPhienBan',
];

/**
 * Lấy context gần nhất của conversation.
 */
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
 * Lưu/cập nhật context.
 */
async function saveContext(data) {
  if (!data || !data.conversationId) {
    logger.warn('saveContext: thiếu conversationId');
    return null;
  }

  try {
    const existing = await Context.findOne({ conversationId: data.conversationId });

    const payload = {};
    for (const field of FIELDS_14) {
      if (data[field] !== undefined) payload[field] = data[field];
    }
    if (data.category !== undefined) payload.category = data.category;
    if (data.keywords !== undefined) payload.keywords = data.keywords;
    if (data.intentHistory !== undefined) payload.intentHistory = data.intentHistory;
    if (data.userProfileSnapshot !== undefined) payload.userProfileSnapshot = data.userProfileSnapshot;
    if (data.extendedContext !== undefined) payload.extendedContext = data.extendedContext;

    if (existing) {
      Object.assign(existing, payload);
      await existing.save();
      return existing.toObject();
    }

    const ctx = await Context.create({
      conversationId: data.conversationId,
      userId: data.userId || null,
      guestSessionId: data.guestSessionId || null,
      ...payload,
    });
    return ctx.toObject();
  } catch (err) {
    logger.warn(`saveContext lỗi: ${err.message}`);
    return null;
  }
}

/**
 * [MỚI] Ghi intent vào lịch sử (giữ tối đa 50 phần tử).
 */
async function pushIntent(conversationId, intent) {
  if (!conversationId || !intent) return null;
  try {
    const ctx = await Context.findOne({ conversationId });
    if (!ctx) return null;

    const history = Array.isArray(ctx.intentHistory) ? ctx.intentHistory : [];
    history.push(intent);
    ctx.intentHistory = history.slice(-50);

    await ctx.save();
    return ctx.intentHistory;
  } catch (err) {
    logger.warn(`pushIntent lỗi: ${err.message}`);
    return null;
  }
}

module.exports = { getContext, saveContext, pushIntent, FIELDS_14 };