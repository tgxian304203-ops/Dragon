/* ═══════════════════════════════════════════════════════════════
   🧠 ĐỌC NGỮ CẢNH (N1–N7)
   ═══════════════════════════════════════════════════════════════ */

const Message = require('../models/message.model');
const Conversation = require('../models/conversation.model');
const Context = require('../models/context.model');
const { MAX_MESSAGES_PER_CONV } = require('../config/constants');
const logger = require('../utils/logger');

async function docNguCanh({ conversationId, userId, guestSessionId }) {
  if (!conversationId) throw new Error('Thiếu conversationId');

  const conversation = await Conversation.findById(conversationId).lean();
  if (!conversation) throw new Error('Không tìm thấy conversation');

  if (userId && conversation.userId && String(conversation.userId) !== String(userId)) {
    throw new Error('Conversation không thuộc user này');
  }
  if (guestSessionId && conversation.guestSessionId && String(conversation.guestSessionId) !== String(guestSessionId)) {
    throw new Error('Conversation không thuộc guest này');
  }

  const allMessages = await Message
    .find({ conversationId })
    .sort({ createdAt: 1 })
    .limit(MAX_MESSAGES_PER_CONV)
    .lean();

  const latestContext = await Context
    .findOne({ conversationId })
    .sort({ createdAt: -1 })
    .lean();

  logger.debug(`docNguCanh: ${allMessages.length} tin`);

  return {
    conversation: {
      id: conversation._id.toString(),
      title: conversation.title,
      projectId: conversation.projectId?.toString() || null,
      messageCount: conversation.messageCount,
    },
    allMessages,
    totalMessages: allMessages.length,
    context: latestContext || null,
  };
}

function rutGonChoNao({ context, problem, recentCount = 20 }) {
  const parts = [];
  parts.push(`📌 VẤN ĐỀ HIỆN TẠI:\n${problem}`);

  const ctx = context.context;
  if (ctx) {
    if (ctx.nguyenLy) parts.push(`\n📌 Nguyên lý (Context):\n${ctx.nguyenLy}`);
    if (ctx.quyTac) parts.push(`\n📏 Quy tắc:\n${ctx.quyTac}`);
    if (ctx.dieuKien) parts.push(`\n🔗 Điều kiện:\n${ctx.dieuKien}`);
    if (ctx.phuongPhap) parts.push(`\n🛠️ Phương pháp:\n${ctx.phuongPhap}`);
    if (ctx.suyLuan) parts.push(`\n🧠 Suy luận:\n${ctx.suyLuan}`);
    if (ctx.quanHe && ctx.quanHe.length > 0) parts.push(`\n🔗 Quan hệ: ${ctx.quanHe.join(', ')}`);
  }

  const recent = (context.allMessages || []).slice(-recentCount);
  if (recent.length > 0) {
    parts.push(`\n💬 ${recent.length} TIN GẦN NHẤT:`);
    for (const m of recent) {
      const role = m.role === 'user' ? 'User' : (m.role === 'ai' ? 'AI' : 'System');
      let content = m.text || '';
      if (m.hasImage && m.imageDescription) content += `\n[Ảnh]: ${m.imageDescription}`;
      if (m.hasFile && m.fileText) content += `\n[File ${m.fileName}]: ${m.fileText.slice(0, 500)}`;
      parts.push(`[${role}]: ${content}`);
    }
  }

  return parts.join('\n');
}

module.exports = { docNguCanh, rutGonChoNao };