/* ═══════════════════════════════════════════════════════════════
   🔗 CONTEXT RELATION — Kho 1 (K1g)
   ═══════════════════════════════════════════════════════════════ */

const mongoose = require('mongoose');

const contextRelationSchema = new mongoose.Schema(
  {
    fromContextId: {
      type: mongoose.Schema.Types.ObjectId, ref: 'Context',
      required: true, index: true,
    },
    toContextId: {
      type: mongoose.Schema.Types.ObjectId, ref: 'Context',
      required: true, index: true,
    },
    relationType: {
      type: String,
      enum: ['follows', 'related', 'depends_on', 'contradicts', 'extends'],
      default: 'related',
    },
    note: { type: String, default: '', maxlength: 5000 },
  },
  { timestamps: true, collection: 'context_relations' }
);

contextRelationSchema.index({ fromContextId: 1, toContextId: 1 }, { unique: true });

module.exports = mongoose.model('ContextRelation', contextRelationSchema);