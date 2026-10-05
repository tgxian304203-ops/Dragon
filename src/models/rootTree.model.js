/* ═══════════════════════════════════════════════════════════════
   🌳 ROOT TREE — Kho 2 — Cây gốc đa thế hệ
   - Mỗi nhánh là 1 document
   - Nhánh có 35 trường: 14 nội dung + 4 máy + 6 gen + 4 metadata + 1 cây + 1 con + 3 feedback + 2 timestamp
   ═══════════════════════════════════════════════════════════════ */

const mongoose = require('mongoose');
const { getDB2 } = require('../config/db2');

const rootTreeSchema = new mongoose.Schema(
  {
    /* ═══ 6 trường gen (quan hệ) ═══ */
    id: { type: String, required: true, unique: true, index: true },
    parent: { type: String, default: 'root', index: true },
    cha: { type: String, default: null, index: true },
    me: { type: String, default: null, index: true },
    name: { type: String, default: '', trim: true, maxlength: 200 },
    depth: { type: Number, default: 1, index: true },

    /* ═══ 14 trường nội dung ═══ */
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
    nguonPhienBan:  { type: String, default: 'Rồng Thần v2.0', maxlength: 10000 },

    /* ═══ 4 trường máy ═══ */
    patterns: { type: [String], default: [] },
    logicType: {
      type: String,
      enum: ['expr', 'code', 'patch', ''],
      default: '',
    },
    logicValue: { type: String, default: '', maxlength: 100000 },
    outputTpl: { type: String, default: '', maxlength: 10000 },

    /* ═══ 1 trường cây quyết định JSON ═══ */
    cayQuyetDinhJson: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },

    /* ═══ 1 trường con ═══ */
    children: { type: [String], default: [] },

    /* ═══ 4 trường metadata ═══ */
    category: { type: String, default: 'general', index: true },
    keywords: { type: [String], default: [] },
    qualityScore: { type: Number, default: 0, min: 0, max: 100 },
    tests: { type: Array, default: [] },

    /* ═══ 3 trường feedback ═══ */
    usageCount: { type: Number, default: 0, index: true },
    successCount: { type: Number, default: 0 },
    failCount: { type: Number, default: 0 },
    lastUsedAt: { type: Date, default: null },

    /* ═══ Trạng thái ═══ */
    isActive: { type: Boolean, default: true, index: true },
  },
  { timestamps: true, collection: 'root_trees' }
);

/* ═══ Index ═══ */
rootTreeSchema.index({ id: 1 }, { unique: true });
rootTreeSchema.index({ parent: 1 });
rootTreeSchema.index({ cha: 1 });
rootTreeSchema.index({ me: 1 });
rootTreeSchema.index({ depth: 1 });
rootTreeSchema.index({ category: 1 });
rootTreeSchema.index({ usageCount: -1 });
rootTreeSchema.index({ isActive: 1, depth: 1 });

/* ═══ Validate ═══ */
rootTreeSchema.pre('save', function (next) {
  if (!this.id || this.id.trim() === '') {
    return next(new Error('Nhánh phải có "id" không rỗng'));
  }
  if (!this.nguyenLy || this.nguyenLy.trim() === '') {
    return next(new Error('Nhánh phải có "nguyenLy" không rỗng'));
  }
  next();
});

let RootTreeModel = null;

function getRootTreeModel() {
  if (!RootTreeModel) {
    RootTreeModel = getDB2().model('RootTree', rootTreeSchema);
  }
  return RootTreeModel;
}

module.exports = { getRootTreeModel };