/* ═══════════════════════════════════════════════════════════════
   📚 TIP — Kho 2 (K2a, K2b) — 14 trường + category
   ═══════════════════════════════════════════════════════════════ */

const mongoose = require('mongoose');
const { getDB2 } = require('../config/db2');

const tipSchema = new mongoose.Schema(
  {
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

    category: { type: String, default: 'general', index: true },
    keywords: { type: [String], default: [], index: true },
    qualityScore: { type: Number, default: 0, min: 0, max: 100 },
  },
  { timestamps: true, collection: 'tips' }
);

tipSchema.index({ keywords: 1 });
tipSchema.index({ category: 1 });
tipSchema.index({ createdAt: -1 });

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