/* ═══════════════════════════════════════════════════════════════
   💬 MESSAGE — Kho 1
   ═══════════════════════════════════════════════════════════════ */

const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema(
  {
    conversationId: {
      type: mongoose.Schema.Types.ObjectId, ref: 'Conversation',
      required: true, index: true,
    },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null, index: true },
    guestSessionId: { type: mongoose.Schema.Types.ObjectId, ref: 'GuestSession', default: null, index: true },

    role: { type: String, enum: ['user', 'ai', 'system'], required: true },
    text: { type: String, default: '', maxlength: 500000 },

    hasImage: { type: Boolean, default: false },
    imageDescription: { type: String, default: '', maxlength: 200000 },

    hasVoice: { type: Boolean, default: false },

    hasFile: { type: Boolean, default: false },
    fileName: { type: String, default: '', maxlength: 500 },
    fileType: { type: String, default: '', maxlength: 50 },
    fileText: { type: String, default: '', maxlength: 2000000 },
  },
  { timestamps: true, collection: 'messages' }
);

messageSchema.index({ conversationId: 1, createdAt: 1 });

module.exports = mongoose.model('Message', messageSchema);