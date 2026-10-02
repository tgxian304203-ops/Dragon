/* ═══════════════════════════════════════════════════════════════
   🔗 SHARE SERVICE (SH1–SH6)
   ═══════════════════════════════════════════════════════════════ */

const Share = require('../models/share.model');
const Conversation = require('../models/conversation.model');
const Message = require('../models/message.model');
const { generateToken } = require('../utils/helpers');
const logger = require('../utils/logger');

async function createShare({ conversationId, userId, guestSessionId }) {
  if (!conversationId) throw new Error('Thiếu conversationId');

  const conv = await Conversation.findById(conversationId).lean();
  if (!conv) throw new Error('Không tìm thấy conversation');

  if (userId && String(conv.userId) !== String(userId)) throw new Error('Không có quyền');
  if (guestSessionId && String(conv.guestSessionId) !== String(guestSessionId)) throw new Error('Không có quyền');

  const query = { conversationId };
  if (userId) query.userId = userId;
  else query.guestSessionId = guestSessionId;

  const existing = await Share.findOne(query).lean();
  if (existing) {
    return {
      slug: existing.slug,
      url: `/share/${existing.slug}`,
      createdAt: existing.createdAt,
    };
  }

  let slug, share;
  for (let i = 0; i < 5; i++) {
    slug = generateToken(12);
    try {
      share = await Share.create({
        userId: userId || null,
        guestSessionId: guestSessionId || null,
        conversationId,
        slug,
        viewCount: 0,
      });
      break;
    } catch (err) {
      if (err.code !== 11000) throw err;
    }
  }

  if (!share) throw new Error('Không tạo được slug sau 5 lần');

  logger.success(`Tạo share: ${slug}`);

  return {
    slug: share.slug,
    url: `/share/${share.slug}`,
    createdAt: share.createdAt,
  };
}

async function getShareBySlug(slug) {
  if (!slug) throw new Error('Thiếu slug');

  const share = await Share.findOne({ slug }).lean();
  if (!share) throw new Error('Link không tồn tại');

  await Share.updateOne({ _id: share._id }, { $inc: { viewCount: 1 } });

  const conv = await Conversation.findById(share.conversationId).lean();
  if (!conv) throw new Error('Conversation đã bị xóa');

  const messages = await Message.find({ conversationId: share.conversationId })
    .sort({ createdAt: 1 })
    .lean();

  return {
    title: conv.title,
    createdAt: conv.createdAt,
    messages: messages.map((m) => ({
      role: m.role,
      text: m.text,
      hasImage: !!m.hasImage,
      imageDescription: m.imageDescription || '',
      hasVoice: !!m.hasVoice,
      hasFile: !!m.hasFile,
      fileName: m.fileName || '',
      createdAt: m.createdAt,
    })),
  };
}

async function deleteShare({ conversationId, userId, guestSessionId }) {
  const query = { conversationId };
  if (userId) query.userId = userId;
  else query.guestSessionId = guestSessionId;

  const share = await Share.findOne(query);
  if (!share) throw new Error('Không có share để xóa');

  await Share.deleteOne({ _id: share._id });
  return { success: true };
}

async function listShares(userId, guestSessionId) {
  const query = userId ? { userId } : { guestSessionId };
  const shares = await Share.find(query).sort({ createdAt: -1 }).lean();

  return shares.map((s) => ({
    id: s._id.toString(),
    conversationId: s.conversationId.toString(),
    slug: s.slug,
    url: `/share/${s.slug}`,
    viewCount: s.viewCount,
    createdAt: s.createdAt,
  }));
}

module.exports = { createShare, getShareBySlug, deleteShare, listShares };