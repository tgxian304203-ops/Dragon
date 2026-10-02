/* ═══════════════════════════════════════════════════════════════
   🥷 GUEST MIDDLEWARE (MW4)
   ═══════════════════════════════════════════════════════════════ */

const GuestSession = require('../models/guestSession.model');
const logger = require('../utils/logger');

async function identifyGuest(req, res, next) {
  req.guest = null;

  const token = req.headers['x-guest-token'];
  if (!token || typeof token !== 'string') return next();

  try {
    const session = await GuestSession.findOne({ sessionToken: token }).lean();
    if (session) {
      req.guest = {
        sessionId: session._id,
        sessionToken: session.sessionToken,
        isConverted: session.isConverted,
        convertedToUserId: session.convertedToUserId,
      };
    }
  } catch (err) {
    logger.debug('Guest middleware lỗi:', err.message);
  }

  next();
}

module.exports = { identifyGuest };