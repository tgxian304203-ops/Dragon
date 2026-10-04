/* ═══════════════════════════════════════════════════════════════
   💬 CHAT CONTROLLER
   - Xử lý tin nhắn user → Rồng Thần
   - [MỚI] Cập nhật metadata conversation (lastCodeLang, intent, topicFlow)
   ═══════════════════════════════════════════════════════════════ */

const mongoose = require('mongoose');
const rongThan = require('../core/rongThan');
const Conversation = require('../models/conversation.model');
const Message = require('../models/message.model');
const logger = require('../utils/logger');

const MAX_MESSAGES_PER_CONV = 1000;

function getOwner(req) {
  if (req.user && req.user.userId) return { userId: req.user.userId, guestSessionId: null };
  if (req.guest && req.guest.sessionId) return { userId: null, guestSessionId: req.guest.sessionId };
  return null;
}

/* ═══════════════════════════════════════════════════════════════
   [MỚI] Cập nhật metadata conversation sau mỗi tin nhắn
   ═══════════════════════════════════════════════════════════════ */

async function capNhatMetadata(conversationId, reply, userMessage) {
  if (!conversationId) return;

  try {
    const conv = await Conversation.findById(conversationId);
    if (!conv) return;

    const metadata = conv.metadata || {};

    // 1. lastCodeLang — detect từ reply
    if (reply.language) {
      metadata.lastCodeLang = reply.language;
    }

    // 2. lastIntent — detect từ userMessage
    const intent = detectIntent(userMessage);
    if (intent) metadata.lastIntent = intent;

    // 3. topicFlow — thêm chủ đề từ userMessage (giữ 20 phần tử cuối)
    const topic = extractTopic(userMessage);
    if (topic) {
      const topics = Array.isArray(metadata.topicFlow) ? metadata.topicFlow : [];
      if (topics[topics.length - 1] !== topic) {
        topics.push(topic);
        metadata.topicFlow = topics.slice(-20);
      }
    }

    // 4. codeHistory — thêm lang vào lịch sử (giữ 20 phần tử cuối)
    if (reply.language) {
      const hist = Array.isArray(metadata.codeHistory) ? metadata.codeHistory : [];
      hist.push(reply.language);
      metadata.codeHistory = hist.slice(-20);
    }

    // 5. intentFlow — thêm intent (giữ 30 phần tử cuối)
    if (intent) {
      const flow = Array.isArray(metadata.intentFlow) ? metadata.intentFlow : [];
      flow.push(intent);
      metadata.intentFlow = flow.slice(-30);
    }

    conv.metadata = metadata;
    await conv.save();

    logger.debug(
      `📝 Metadata cập nhật: lastCodeLang=${metadata.lastCodeLang}, ` +
      `lastIntent=${metadata.lastIntent}, topic=${topic}`
    );
  } catch (err) {
    logger.warn(`capNhatMetadata lỗi: ${err.message}`);
  }
}

function detectIntent(text) {
  if (!text) return '';
  const q = String(text).toLowerCase();
  if (/\b(sửa|fix|debug|lỗi|bug|error|khắc phục)\b/i.test(q)) return 'bugfix';
  if (/\b(viết|tạo|code|lập trình|hàm|function|script|xây dựng)\b/i.test(q)) return 'code';
  if (/\b(tính|cộng|trừ|nhân|chia|tổng|hiệu|tích|thương|mũ)\b/i.test(q)) return 'math';
  if (/\b(giải thích|tại sao|vì sao|khái niệm|định nghĩa)\b/i.test(q)) return 'explain';
  return 'general';
}

function extractTopic(text) {
  if (!text) return '';
  const q = String(text).toLowerCase();
  if (/shop|bán hàng|cửa hàng/.test(q)) return 'shop';
  if (/web|trang web|landing/.test(q)) return 'web';
  if (/api|gọi api/.test(q)) return 'api';
  if (/chatbot|\bai\b/.test(q)) return 'ai';
  if (/game/.test(q)) return 'game';
  if (/tool|công cụ/.test(q)) return 'tool';
  if (/dashboard/.test(q)) return 'dashboard';
  if (/toán|cộng|trừ|nhân|chia/.test(q)) return 'math';
  return '';
}

/* ═══════════════════════════════════════════════════════════════
   GỬI TIN NHẮN
   ═══════════════════════════════════════════════════════════════ */

async function send(req, res) {
  try {
    const owner = getOwner(req);
    if (!owner) {
      return res.status(401).json({ error: 'Chưa xác thực' });
    }

    const { message, conversationId: bodyConvId, projectId } = req.body || {};
    if (!message || message.trim() === '') {
      return res.status(400).json({ error: 'Tin nhắn rỗng' });
    }

    /* ═══ Lấy hoặc tạo Conversation ═══ */
    let conversation;
    if (bodyConvId) {
      conversation = await Conversation.findOne({
        _id: bodyConvId,
        ...(owner.userId ? { userId: owner.userId } : { guestSessionId: owner.guestSessionId }),
      });
      if (!conversation) {
        return res.status(404).json({ error: 'Không tìm thấy conversation' });
      }
    } else {
      conversation = await Conversation.create({
        userId: owner.userId,
        guestSessionId: owner.guestSessionId,
        projectId: projectId || null,
        title: message.slice(0, 60) + (message.length > 60 ? '...' : ''),
      });
    }

    /* ═══ Lưu tin nhắn user ═══ */
    await Message.create({
      conversationId: conversation._id,
      role: 'user',
      text: message,
    });

    /* ═══ Gọi Rồng Thần ═══ */
    const result = await rongThan.xuLy({
      message,
      conversationId: conversation._id.toString(),
      userId: owner.userId,
      guestSessionId: owner.guestSessionId,
    });

    /* ═══ Lưu tin nhắn AI ═══ */
    await Message.create({
      conversationId: conversation._id,
      role: 'ai',
      text: result.answer || '',
      code: result.code || null,
      language: result.language || null,
      output: result.output || null,
      source: result.source || '',
    });

    /* ═══ Cập nhật Conversation ═══ */
    conversation.messageCount = (conversation.messageCount || 0) + 2;
    conversation.lastMessageAt = new Date();

    // Nếu là tin nhắn đầu → đặt title
    if (conversation.messageCount <= 2) {
      conversation.title = message.slice(0, 60) + (message.length > 60 ? '...' : '');
    }

    await conversation.save();

    /* ═══ [MỚI] Cập nhật metadata ═══ */
    await capNhatMetadata(conversation._id.toString(), result, message);

    /* ═══ Cắt bớt tin nhắn nếu > 1000 ═══ */
    if (conversation.messageCount > MAX_MESSAGES_PER_CONV) {
      const excess = conversation.messageCount - MAX_MESSAGES_PER_CONV;
      const oldestMsgs = await Message.find({ conversationId: conversation._id })
        .sort({ createdAt: 1 })
        .limit(excess)
        .select('_id');

      if (oldestMsgs.length > 0) {
        await Message.deleteMany({ _id: { $in: oldestMsgs.map((m) => m._id) } });
        logger.debug(`Đã cắt ${oldestMsgs.length} tin nhắn cũ của conv ${conversation._id}`);
      }
    }

    return res.json({
      conversationId: conversation._id.toString(),
      reply: result.answer || '',
      code: result.code || null,
      language: result.language || null,
      output: result.output || null,
      source: result.source || '',
      meta: result.meta || {},
    });
  } catch (err) {
    logger.error('Chat send lỗi:', err.message);
    return res.status(500).json({ error: err.message || 'Lỗi server' });
  }
}

module.exports = { send, capNhatMetadata, detectIntent, extractTopic };