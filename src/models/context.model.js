/* ═══════════════════════════════════════════════════════════════
   🧠 CONTEXT — Kho 1
   - 14 trường text + category + keywords
   - [MỚI] intentHistory, userProfileSnapshot, extendedContext
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

    /* ═══ [MỚI] Mở rộng — cho Rồng Thần hiểu hơn ═══ */
    intentHistory: {
      type: [String],
      default: [],
      // VD ["code", "code", "math", "code"] — giới hạn 50 phần tử cuối
    },
    userProfileSnapshot: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
      // Snapshot profile user tại thời điểm này — để debug + phục hồi
    },
    extendedContext: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
      // Chỗ linh hoạt cho tương lai
    },
  },
  { timestamps: true, collection: 'contexts' }
);

contextSchema.index({ conversationId: 1, createdAt: -1 });
contextSchema.index({ userId: 1, createdAt: -1 });

module.exports = mongoose.model('Context', contextSchema);