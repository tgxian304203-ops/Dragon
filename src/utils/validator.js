/* ═══════════════════════════════════════════════════════════════
   🔍 VALIDATOR (UT2)
   ═══════════════════════════════════════════════════════════════ */

const mongoose = require('mongoose');

module.exports = {
  isUsername: (u) => typeof u === 'string' && /^[a-zA-Z0-9_]{3,32}$/.test(u),
  isPassword: (p) => typeof p === 'string' && p.length >= 6 && p.length <= 128,
  isText: (t, max = 100000) => typeof t === 'string' && t.trim().length > 0 && t.length <= max,
  isProvider: (p) => ['gemini', 'groq', 'openrouter'].includes(p),
  isSide: (s) => ['left', 'right'].includes(s),
  isObjectId: (id) => mongoose.Types.ObjectId.isValid(id),
  isEmpty: (v) => v == null || (typeof v === 'string' && v.trim() === ''),
  sanitizeText: (t) => typeof t === 'string'
    ? t.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
    : '',
};