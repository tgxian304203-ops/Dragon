/* ═══════════════════════════════════════════════════════════════
   🧠 CONTEXT — Kho 1 — 14 trường JSON + category
   ═══════════════════════════════════════════════════════════════ */

const mongoose = require('mongoose');

const contextSchema = new mongoose.Schema(
  {
    conversationId: {
      type: mongoose.Schema.Types.ObjectId, ref: 'Conversation',
      required: true, index: true,
    },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null, index: true },
    guestSessionId: { type: mongoose.Schema.Types.ObjectId, ref: 'GuestSession', default: null, index: true },

    nguyenLy:       { type: mongoose.Schema.Types.Mixed, default: '' },
    quyTac:         { type: mongoose.Schema.Types.Mixed, default: [] },
    dieuKien:       { type: mongoose.Schema.Types.Mixed, default: [] },
    cayQuyetDinh:   { type: mongoose.Schema.Types.Mixed, default: null },
    phuongPhap:     { type: mongoose.Schema.Types.Mixed, default: '' },
    thuatToan:      { type: mongoose.Schema.Types.Mixed, default: [] },
    workflow:       { type: mongoose.Schema.Types.Mixed, default: null },
    suyLuan:        { type: mongoose.Schema.Types.Mixed, default: [] },
    testCase:       { type: mongoose.Schema.Types.Mixed, default: [] },
    kiemChung:      { type: mongoose.Schema.Types.Mixed, default: null },
    ngoaiLe:        { type: mongoose.Schema.Types.Mixed, default: [] },
    caseKinhNghiem: { type: mongoose.Schema.Types.Mixed, default: [] },
    quanHe:         { type: [String], default: [] },
    nguonPhienBan:  { type: String, default: '', maxlength: 10000 },

    category: { type: String, default: 'general' },
    keywords: { type: [String], default: [] },
  },
  { timestamps: true, collection: 'contexts', strict: false }
);

contextSchema.index({ conversationId: 1, createdAt: -1 });

module.exports = mongoose.model('Context', contextSchema);