/* ═══════════════════════════════════════════════════════════════
   💬 MESSAGE LIMIT (K1c)
   ═══════════════════════════════════════════════════════════════ */

const Message = require('../models/message.model');
const Conversation = require('../models/conversation.model');
const { MAX_MESSAGES_PER_CONV } = require('../config/constants');
const logger = require('../utils/logger');

async function addMessage({
  conversationId, userId, guestSessionId,
  role, text, extra = {},
}) {
  if (!conversationId) throw new Error('Thiếu conversationId');
  if (!['user', 'ai', 'system'].includes(role)) throw new Error('role không hợp lệ');

  const count = await Message.countDocuments({ conversationId });

  if (count >= MAX_MESSAGES_PER_CONV) {
    const toDelete = count - MAX_MESSAGES_PER_CONV + 1;
    const oldest = await Message.find({ conversationId })
      .sort({ createdAt: 1 })
      .limit(toDelete)
      .select('_id')
      .lean();

    if (oldest.length > 0) {
      await Message.deleteMany({ _id: { $in: oldest.map((m) => m._id) } });
      logger.info(`Xóa ${oldest.length} tin cũ của conv ${conversationId}`);
    }
  }

  const msg = await Message.create({
    conversationId,
    userId: userId || null,
    guestSessionId: guestSessionId || null,
    role,
    text: text || '',
    hasImage: !!extra.hasImage,
    imageDescription: extra.imageDescription || '',
    hasVoice: !!extra.hasVoice,
    hasFile: !!extra.hasFile,
    fileName: extra.fileName || '',
    fileType: extra.fileType || '',
    fileText: extra.fileText || '',
  });

  await Conversation.updateOne(
    { _id: conversationId },
    {
      $inc: { messageCount: 1 },
      $set: { lastMessageAt: new Date() },
    }
  );

  return msg;
}

async function getRecentMessages(conversationId, limit = 1000) {
  return Message.find({ conversationId })
    .sort({ createdAt: -1 })
    .limit(limit)
    .lean();
}

module.exports = { addMessage, getRecentMessages };