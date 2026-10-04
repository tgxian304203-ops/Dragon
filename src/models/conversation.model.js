/* ═══════════════════════════════════════════════════════════════
   💬 CONVERSATION — Kho 1
   - [MỚI] Metadata: lastCodeLang, lastIntent, topicFlow...
   ═══════════════════════════════════════════════════════════════ */

const mongoose = require('mongoose');

const conversationSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null, index: true },
    guestSessionId: { type: mongoose.Schema.Types.ObjectId, ref: 'GuestSession', default: null, index: true },
    projectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', default: null, index: true },
    title: { type: String, default: 'Cuộc trò chuyện mới', trim: true, maxlength: 200 },
    messageCount: { type: Number, default: 0, min: 0 },
    lastMessageAt: { type: Date, default: Date.now, index: true },

    /* ═══ [MỚI] Metadata — cho Rồng Thần hiểu ngữ cảnh ═══ */
    metadata: {
      lastCodeLang: {
        type: String,
        enum: ['html', 'python', 'javascript', 'java', 'cpp', 'go', 'rust', 'react-native', 'flutter', ''],
        default: '',
        index: true,
      },
      lastIntent: {
        type: String,
        enum: ['math', 'code', 'bugfix', 'explain', 'general', ''],
        default: '',
      },
      currentProjectType: {
        type: String,
        default: '',   // VD "web shop", "api tool", "chatbot"
      },
      topicFlow: { type: [String], default: [] },        // VD ["web", "shop", "checkout"]
      codeHistory: { type: [String], default: [] },      // VD ["html", "html", "python"]
      intentFlow: { type: [String], default: [] },       // VD ["code", "code", "math"]
    },
  },
  { timestamps: true, collection: 'conversations' }
);

conversationSchema.index({ userId: 1, lastMessageAt: -1 });
conversationSchema.index({ guestSessionId: 1, lastMessageAt: -1 });
conversationSchema.index({ userId: 1, projectId: 1 });
conversationSchema.index({ guestSessionId: 1, projectId: 1 });
conversationSchema.index({ 'metadata.lastCodeLang': 1 });

module.exports = mongoose.model('Conversation', conversationSchema);