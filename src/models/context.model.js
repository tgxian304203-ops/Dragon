/* ═══════════════════════════════════════════════════════════════
   🧠 CONTEXT — Kho 1 (K1f) — 14 trường như TIP + category
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

    nguyenLy:       { type: String, default: '', maxlength: 100000 },
    quyTac:         { type: String, default: '', maxlength: 100000 },
    dieuKien:       { type: String, default: '', maxlength: 100000 },
    cayQuyetDinh:   { type: String, default: '', maxlength: 100000 },
    phuongPhap:     { type: String, default: '', maxlength: 100000 },
    thuatToan:      { type: String, default: '', maxlength: 100000 },
    workflow:       { type: String, default: '', maxlength: 100000 },
    suyLuan:        { type: String, default: '', maxlength: 100000 },
    testCase:       { type: String, default: '', maxlength: 100000 },
    kiemChung:      { type: String, default: '', maxlength: 100000 },
    ngoaiLe:        { type: String, default: '', maxlength: 100000 },
    caseKinhNghiem: { type: String, default: '', maxlength: 100000 },
    quanHe:         { type: [String], default: [] },
    nguonPhienBan:  { type: String, default: '', maxlength: 10000 },

    category: { type: String, default: 'general' },
    keywords: { type: [String], default: [] },
  },
  { timestamps: true, collection: 'contexts' }
);

contextSchema.index({ conversationId: 1, createdAt: -1 });

module.exports = mongoose.model('Context', contextSchema);