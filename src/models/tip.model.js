/* ═══════════════════════════════════════════════════════════════
   📚 TIP — Kho 2 — 14 trường text + 4 trường máy + Feedback
   ═══════════════════════════════════════════════════════════════ */

const mongoose = require('mongoose');
const { getDB2 } = require('../config/db2');

const tipSchema = new mongoose.Schema(
  {
    /* ═══ 14 trường text ═══ */
    nguyenLy:       { type: String, required: true, default: '', maxlength: 100000 },
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

    /* ═══ Metadata ═══ */
    category: { type: String, default: 'general', index: true },
    keywords: { type: [String], default: [], index: true },
    qualityScore: { type: Number, default: 0, min: 0, max: 100 },

    /* ═══ 4 trường máy ═══ */
    patterns: { type: [String], default: [] },
    logicType: {
      type: String,
      enum: ['expr', 'code', 'patch', ''],
      default: '',
    },
    logicValue: { type: String, default: '', maxlength: 100000 },
    outputTpl: { type: String, default: '', maxlength: 10000 },

    // Test case
    tests: { type: Array, default: [] },

    /* ═══ [MỚI] Feedback loop ═══ */
    usageCount: { type: Number, default: 0, index: true },      // số lần TIP được chọn để trả lời
    successCount: { type: Number, default: 0 },                 // số lần trả lời thành công
    failCount: { type: Number, default: 0 },                    // số lần trả lời thất bại
    lastUsedAt: { type: Date, default: null },
    version: { type: Number, default: 1 },                      // tăng khi cập nhật nội dung
    mergedFrom: { type: [mongoose.Schema.Types.ObjectId], default: [] }, // các TIP đã gộp vào
    isDeprecated: { type: Boolean, default: false, index: true }, // TIP loãng/kém
    deprecatedReason: { type: String, default: '' },
  },
  { timestamps: true, collection: 'tips' }
);

/* ═══ Index ═══ */
tipSchema.index({ category: 1 });
tipSchema.index({ createdAt: -1 });
tipSchema.index({ usageCount: -1 });
tipSchema.index({ isDeprecated: 1, usageCount: -1 });

/* ═══ Validate ═══ */
tipSchema.pre('save', function (next) {
  if (!this.nguyenLy || this.nguyenLy.trim() === '') {
    return next(new Error('TIP phải có "nguyenLy" không rỗng'));
  }
  next();
});

let TipModel = null;

function getTipModel() {
  if (!TipModel) {
    TipModel = getDB2().model('Tip', tipSchema);
  }
  return TipModel;
}

module.exports = { getTipModel };