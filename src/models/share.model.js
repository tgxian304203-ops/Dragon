/* ═══════════════════════════════════════════════════════════════
   🔗 SHARE — Kho 1 (SH1–SH6)
   ═══════════════════════════════════════════════════════════════ */

const mongoose = require('mongoose');

const shareSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null, index: true },
    guestSessionId: { type: mongoose.Schema.Types.ObjectId, ref: 'GuestSession', default: null, index: true },
    conversationId: {
      type: mongoose.Schema.Types.ObjectId, ref: 'Conversation',
      required: true, index: true,
    },
    slug: { type: String, required: true, unique: true, index: true },
    viewCount: { type: Number, default: 0, min: 0 },
  },
  { timestamps: true, collection: 'shares' }
);

shareSchema.index(
  { conversationId: 1, userId: 1 },
  { unique: true, partialFilterExpression: { userId: { $type: 'objectId' } } }
);
shareSchema.index(
  { conversationId: 1, guestSessionId: 1 },
  { unique: true, partialFilterExpression: { guestSessionId: { $type: 'objectId' } } }
);

module.exports = mongoose.model('Share', shareSchema);