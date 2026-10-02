/* ═══════════════════════════════════════════════════════════════
   🥷 GUEST SESSION — Kho 1 (GU1–GU5)
   ═══════════════════════════════════════════════════════════════ */

const mongoose = require('mongoose');

const guestSessionSchema = new mongoose.Schema(
  {
    sessionToken: { type: String, required: true, unique: true, index: true },
    convertedToUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null, index: true },
    isConverted: { type: Boolean, default: false, index: true },
  },
  { timestamps: true, collection: 'guest_sessions' }
);

module.exports = mongoose.model('GuestSession', guestSessionSchema);