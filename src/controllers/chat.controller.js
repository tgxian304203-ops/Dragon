/* ═══════════════════════════════════════════════════════════════
   💬 CHAT CONTROLLER — nhận metadata + projectId
   - Hỗ trợ tạo conv trong project
   ═══════════════════════════════════════════════════════════════ */

const Conversation = require('../models/conversation.model');
const Project = require('../models/project.model');
const rongThan = require('../core/rongThan');
const messageLimit = require('../services/messageLimit.service');
const validator = require('../utils/validator');
const logger = require('../utils/logger');

function getOwner(req) {
  if (req.user && req.user.userId) return { userId: req.user.userId, guestSessionId: null };
  if (req.guest && req.guest.sessionId) return { userId: null, guestSessionId: req.guest.sessionId };
  return null;
}

/* POST /api/chat/send */
async function send(req, res) {
  const owner = getOwner(req);
  if (!owner) return res.status(401).json({ error: 'Cần đăng nhập hoặc guest session' });

  const {
    message, conversationId, projectId,
    hasImage, imageDescription,
    hasVoice,
    hasFile, fileName, fileType, fileText,
  } = req.body || {};

  if (!validator.isText(message, 500000)) {
    return res.status(400).json({ error: 'Tin nhắn không hợp lệ' });
  }

  let convId = conversationId;

  if (!convId) {
    /* ═══ [MỚI] Kiểm tra projectId nếu có ═══ */
    let validProjectId = null;

    if (projectId) {
      if (!validator.isObjectId(projectId)) {
        return res.status(400).json({ error: 'projectId không hợp lệ' });
      }

      const projectQuery = { _id: projectId };
      if (owner.userId) projectQuery.userId = owner.userId;
      else projectQuery.guestSessionId = owner.guestSessionId;

      const project = await Project.findOne(projectQuery).lean();
      if (!project) {
        return res.status(404).json({ error: 'Không tìm thấy dự án' });
      }

      validProjectId = project._id;
    }

    const title = message.trim().slice(0, 100);
    const conv = await Conversation.create({
      userId: owner.userId,
      guestSessionId: owner.guestSessionId,
      projectId: validProjectId,
      title,
    });
    convId = conv._id.toString();

    /* ═══ [MỚI] Update conversationCount của project ═══ */
    if (validProjectId) {
      const count = await Conversation.countDocuments({ projectId: validProjectId });
      await Project.updateOne(
        { _id: validProjectId },
        { $set: { conversationCount: count } }
      );
      logger.info(`Tạo conv mới trong project ${validProjectId}`);
    }
  } else {
    if (!validator.isObjectId(convId)) {
      return res.status(400).json({ error: 'conversationId không hợp lệ' });
    }

    const conv = await Conversation.findById(convId).lean();
    if (!conv) return res.status(404).json({ error: 'Không tìm thấy conversation' });

    if (owner.userId && String(conv.userId) !== String(owner.userId)) {
      return res.status(403).json({ error: 'Không có quyền' });
    }
    if (owner.guestSessionId && String(conv.guestSessionId) !== String(owner.guestSessionId)) {
      return res.status(403).json({ error: 'Không có quyền' });
    }
  }

  await messageLimit.addMessage({
    conversationId: convId,
    userId: owner.userId,
    guestSessionId: owner.guestSessionId,
    role: 'user',
    text: message.trim(),
    extra: {
      hasImage: !!hasImage,
      imageDescription: imageDescription || '',
      hasVoice: !!hasVoice,
      hasFile: !!hasFile,
      fileName: fileName || '',
      fileType: fileType || '',
      fileText: fileText || '',
    },
  });

  let result;
  try {
    result = await rongThan.xuLy({
      message: message.trim(),
      conversationId: convId,
      userId: owner.userId,
      guestSessionId: owner.guestSessionId,
    });
  } catch (err) {
    logger.error('Rồng Thần lỗi:', err.message);

    await messageLimit.addMessage({
      conversationId: convId,
      userId: owner.userId,
      guestSessionId: owner.guestSessionId,
      role: 'ai',
      text: `⚠️ Lỗi xử lý: ${err.message}`,
    }).catch((e) => logger.error('Lưu AI message lỗi:', e.message));

    return res.status(500).json({ error: err.message });
  }

  await messageLimit.addMessage({
    conversationId: convId,
    userId: owner.userId,
    guestSessionId: owner.guestSessionId,
    role: 'ai',
    text: result.answer || '',
  });

  const currentConv = await Conversation.findById(convId).select('projectId').lean();
  if (currentConv && currentConv.projectId) {
    const count = await Conversation.countDocuments({ projectId: currentConv.projectId });
    await Project.updateOne(
      { _id: currentConv.projectId },
      { $set: { conversationCount: count } }
    );
  }

  res.json({
    conversationId: convId,
    reply: result.answer,
    source: result.source,
    code: result.code || null,
    language: result.language || null,
    output: result.output || null,
    meta: result.meta || {},
  });
}

/* GET /api/chat/:conversationId/history */
async function history(req, res) {
  const owner = getOwner(req);
  if (!owner) return res.status(401).json({ error: 'Cần đăng nhập hoặc guest session' });

  const { conversationId } = req.params;
  if (!validator.isObjectId(conversationId)) {
    return res.status(400).json({ error: 'ID không hợp lệ' });
  }

  const conv = await Conversation.findById(conversationId).lean();
  if (!conv) return res.status(404).json({ error: 'Không tìm thấy conversation' });

  if (owner.userId && String(conv.userId) !== String(owner.userId)) {
    return res.status(403).json({ error: 'Không có quyền' });
  }
  if (owner.guestSessionId && String(conv.guestSessionId) !== String(owner.guestSessionId)) {
    return res.status(403).json({ error: 'Không có quyền' });
  }

  const messages = await messageLimit.getRecentMessages(conversationId, 1000);

  res.json({
    conversation: {
      id: conv._id.toString(),
      title: conv.title,
      messageCount: conv.messageCount,
      projectId: conv.projectId ? conv.projectId.toString() : null,
    },
    messages: messages.reverse().map((m) => ({
      id: m._id.toString(),
      role: m.role,
      text: m.text,
      hasImage: !!m.hasImage,
      imageDescription: m.imageDescription || '',
      hasVoice: !!m.hasVoice,
      hasFile: !!m.hasFile,
      fileName: m.fileName || '',
      createdAt: m.createdAt,
    })),
  });
}

/* DELETE /api/chat/:conversationId */
async function removeConversation(req, res) {
  const owner = getOwner(req);
  if (!owner) return res.status(401).json({ error: 'Cần đăng nhập hoặc guest session' });

  const { conversationId } = req.params;
  if (!validator.isObjectId(conversationId)) {
    return res.status(400).json({ error: 'ID không hợp lệ' });
  }

  const conv = await Conversation.findById(conversationId).lean();
  if (!conv) return res.status(404).json({ error: 'Không tìm thấy' });

  if (owner.userId && String(conv.userId) !== String(owner.userId)) {
    return res.status(403).json({ error: 'Không có quyền' });
  }
  if (owner.guestSessionId && String(conv.guestSessionId) !== String(owner.guestSessionId)) {
    return res.status(403).json({ error: 'Không có quyền' });
  }

  const Message = require('../models/message.model');
  const contextService = require('../services/context.service');
  const Share = require('../models/share.model');

  const projectId = conv.projectId;

  await Promise.all([
    Message.deleteMany({ conversationId }),
    contextService.deleteContextsByConversation(conversationId),
    Share.deleteMany({ conversationId }),
    Conversation.deleteOne({ _id: conversationId }),
  ]);

  if (projectId) {
    const count = await Conversation.countDocuments({ projectId });
    await Project.updateOne({ _id: projectId }, { $set: { conversationCount: count } });
  }

  logger.info(`Xóa conversation ${conversationId}`);
  res.json({ success: true });
}

module.exports = { send, history, removeConversation };