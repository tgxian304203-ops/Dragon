/* ═══════════════════════════════════════════════════════════════
   📚 TIP — Kho 2 — 14 trường JSON structured + 4 trường máy
   ═══════════════════════════════════════════════════════════════ */

const mongoose = require('mongoose');
const { getDB2 } = require('../config/db2');

const tipSchema = new mongoose.Schema(
  {
    // ═══ 14 TRƯỜNG — Mixed (chấp nhận string hoặc JSON) ═══
    nguyenLy:       { type: mongoose.Schema.Types.Mixed, default: '' },       // string
    quyTac:         { type: mongoose.Schema.Types.Mixed, default: [] },       // [string]
    dieuKien:       { type: mongoose.Schema.Types.Mixed, default: [] },       // [{var, op, value}]
    cayQuyetDinh:   { type: mongoose.Schema.Types.Mixed, default: null },     // {if, then, elseIf, else}
    phuongPhap:     { type: mongoose.Schema.Types.Mixed, default: '' },       // string
    thuatToan:      { type: mongoose.Schema.Types.Mixed, default: [] },       // [{step, op, ...}]
    workflow:       { type: mongoose.Schema.Types.Mixed, default: null },     // {input, process, output}
    suyLuan:        { type: mongoose.Schema.Types.Mixed, default: [] },       // [string]
    testCase:       { type: mongoose.Schema.Types.Mixed, default: [] },       // [{input, expected}]
    kiemChung:      { type: mongoose.Schema.Types.Mixed, default: null },     // {type, expr}
    ngoaiLe:        { type: mongoose.Schema.Types.Mixed, default: [] },       // [{when, action, msg}]
    caseKinhNghiem: { type: mongoose.Schema.Types.Mixed, default: [] },       // [string]
    quanHe:         { type: [String], default: [] },                          // [string]
    nguonPhienBan:  { type: String, default: '', maxlength: 10000 },          // string

    // ═══ Metadata ═══
    category: { type: String, default: 'general' },
    keywords: { type: [String], default: [] },
    qualityScore: { type: Number, default: 0, min: 0, max: 100 },

    // ═══ 4 TRƯỜNG MÁY — để chạy nhanh ═══
    patterns: { type: [String], default: [] },
    logicType: {
      type: String,
      enum: ['expr', 'code', 'patch', 'machine', ''],
      default: '',
    },
    logicValue: { type: mongoose.Schema.Types.Mixed, default: '' },
    outputTpl: { type: String, default: '', maxlength: 10000 },
  },
  { timestamps: true, collection: 'tips', strict: false }
);

tipSchema.index({ keywords: 1 });
tipSchema.index({ category: 1 });
tipSchema.index({ createdAt: -1 });

let TipModel = null;

function getTipModel() {
  if (!TipModel) {
    TipModel = getDB2().model('Tip', tipSchema);
  }
  return TipModel;
}

module.exports = { getTipModel };