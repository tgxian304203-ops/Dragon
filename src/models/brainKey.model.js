/* ═══════════════════════════════════════════════════════════════
   🔑 BRAIN KEY — Kho 1 (NT1, NP1, MR7, MR9)
   - Thêm requestsToday + requestsResetAt cho Gemini/OpenRouter
   ═══════════════════════════════════════════════════════════════ */

const mongoose = require('mongoose');

const brainKeySchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null, index: true },
    guestSessionId: { type: mongoose.Schema.Types.ObjectId, ref: 'GuestSession', default: null, index: true },

    side: { type: String, enum: ['left', 'right'], required: true, index: true },
    provider: { type: String, enum: ['gemini', 'groq', 'openrouter'], required: true },

    keyValue: { type: String, required: true },

    alive: { type: Boolean, default: true, index: true },
    availableModels: { type: [String], default: [] },
    quotaPercent: { type: Number, default: 100, min: 0, max: 100 },
    quotaUpdatedAt: { type: Date, default: Date.now },

    // Đếm request cho Gemini + OpenRouter (không có header)
    requestsToday: { type: Number, default: 0 },
    requestsResetAt: { type: Date, default: Date.now },
  },
  { timestamps: true, collection: 'brain_keys' }
);

brainKeySchema.index(
  { side: 1, keyValue: 1, userId: 1 },
  { unique: true, partialFilterExpression: { userId: { $type: 'objectId' } } }
);
brainKeySchema.index(
  { side: 1, keyValue: 1, guestSessionId: 1 },
  { unique: true, partialFilterExpression: { guestSessionId: { $type: 'objectId' } } }
);

brainKeySchema.index({ side: 1, alive: 1, userId: 1 });
brainKeySchema.index({ side: 1, alive: 1, guestSessionId: 1 });

brainKeySchema.set('toJSON', {
  transform: (doc, ret) => { delete ret.keyValue; return ret; },
});

module.exports = mongoose.model('BrainKey', brainKeySchema);