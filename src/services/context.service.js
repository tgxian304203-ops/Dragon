/* ═══════════════════════════════════════════════════════════════
   🧠 CONTEXT SERVICE — 14 trường + ContextRelation (K1g)
   ═══════════════════════════════════════════════════════════════ */

const Context = require('../models/context.model');
const ContextRelation = require('../models/contextRelation.model');
const logger = require('../utils/logger');

async function saveContext({
  conversationId, userId, guestSessionId,
  nguyenLy = '', quyTac = '', dieuKien = '', cayQuyetDinh = '',
  phuongPhap = '', thuatToan = '', workflow = '', suyLuan = '',
  testCase = '', kiemChung = '', ngoaiLe = '', caseKinhNghiem = '',
  quanHe = [], nguonPhienBan = '',
  category = 'general',
  keywords = [],
}) {
  if (!conversationId) throw new Error('Thiếu conversationId');

  const context = await Context.create({
    conversationId,
    userId: userId || null,
    guestSessionId: guestSessionId || null,
    nguyenLy, quyTac, dieuKien, cayQuyetDinh,
    phuongPhap, thuatToan, workflow, suyLuan,
    testCase, kiemChung, ngoaiLe, caseKinhNghiem,
    quanHe, nguonPhienBan,
    category,
    keywords,
  });

  // K1g: Tự động tạo quan hệ với Context trước đó
  try {
    const prev = await Context
      .findOne({ conversationId, _id: { $ne: context._id } })
      .sort({ createdAt: -1 })
      .lean();

    if (prev) {
      await ContextRelation.create({
        fromContextId: prev._id,
        toContextId: context._id,
        relationType: 'follows',
        note: 'Context tiếp nối trong cùng conversation',
      });
    }
  } catch (err) {
    if (err.code !== 11000) {
      logger.warn('Tạo ContextRelation lỗi:', err.message);
    }
  }

  logger.debug(`Lưu Context cho conv ${conversationId} [${category}]`);
  return context;
}

async function getLatestContext(conversationId) {
  return Context.findOne({ conversationId }).sort({ createdAt: -1 }).lean();
}

async function deleteContextsByConversation(conversationId) {
  const contexts = await Context.find({ conversationId }).select('_id').lean();
  const ids = contexts.map((c) => c._id);

  if (ids.length > 0) {
    await ContextRelation.deleteMany({
      $or: [
        { fromContextId: { $in: ids } },
        { toContextId: { $in: ids } },
      ],
    });
  }

  return Context.deleteMany({ conversationId });
}

async function getRelatedContexts(contextId) {
  return ContextRelation
    .find({ $or: [{ fromContextId: contextId }, { toContextId: contextId }] })
    .lean();
}

module.exports = {
  saveContext,
  getLatestContext,
  deleteContextsByConversation,
  getRelatedContexts,
};