/* ═══════════════════════════════════════════════════════════════
   📁 PROJECT — Kho 1 (PJ1–PJ6)
   ═══════════════════════════════════════════════════════════════ */

const mongoose = require('mongoose');

const projectSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null, index: true },
    guestSessionId: { type: mongoose.Schema.Types.ObjectId, ref: 'GuestSession', default: null, index: true },
    name: { type: String, required: true, trim: true, maxlength: 200 },
    description: { type: String, default: '', maxlength: 2000 },
    conversationCount: { type: Number, default: 0, min: 0 },
  },
  { timestamps: true, collection: 'projects' }
);

projectSchema.index({ userId: 1, createdAt: -1 });
projectSchema.index({ guestSessionId: 1, createdAt: -1 });

module.exports = mongoose.model('Project', projectSchema);