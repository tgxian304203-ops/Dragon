/* ═══════════════════════════════════════════════════════════════
   👤 USER — Kho 1 (tối đa 50 user — K1a)
   ═══════════════════════════════════════════════════════════════ */

const mongoose = require('mongoose');

const userSchema = new mongoose.Schema(
  {
    username: {
      type: String, required: true, unique: true, trim: true,
      minlength: 3, maxlength: 32, index: true,
    },
    passwordHash: { type: String, required: true },
    displayName: { type: String, trim: true, maxlength: 64, default: '' },
  },
  { timestamps: true, collection: 'users' }
);

userSchema.index({ createdAt: 1 });

userSchema.set('toJSON', {
  transform: (doc, ret) => { delete ret.passwordHash; return ret; },
});

module.exports = mongoose.model('User', userSchema);