/* ═══════════════════════════════════════════════════════════════
   📊 QUOTA CONTROLLER (MR10)
   ═══════════════════════════════════════════════════════════════ */

const quotaService = require('../services/quota.service');

function getOwner(req) {
  if (req.user && req.user.userId) return { userId: req.user.userId, guestSessionId: null };
  if (req.guest && req.guest.sessionId) return { userId: null, guestSessionId: req.guest.sessionId };
  return null;
}

async function get(req, res) {
  const owner = getOwner(req);
  if (!owner) return res.json({ left: [], right: [] });

  const data = await quotaService.getAllKeys(owner.userId, owner.guestSessionId);
  res.json(data);
}

module.exports = { get };