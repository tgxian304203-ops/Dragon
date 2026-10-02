/* ═══════════════════════════════════════════════════════════════
   🚦 RATE LIMIT — MW1: KHÔNG rate limit
   ═══════════════════════════════════════════════════════════════ */

function rateLimit(req, res, next) {
  next();
}

module.exports = { rateLimit };