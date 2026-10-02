/* ═══════════════════════════════════════════════════════════════
   📊 QUOTA SERVICE (MR10)
   ═══════════════════════════════════════════════════════════════ */

const BrainKey = require('../models/brainKey.model');

async function getKeysBySide(side, userId, guestSessionId) {
  const query = { side, alive: true };
  if (userId) query.userId = userId;
  else if (guestSessionId) query.guestSessionId = guestSessionId;
  else return [];

  const keys = await BrainKey.find(query).sort({ createdAt: 1 }).lean();

  return keys.map((k) => ({
    id: k._id.toString(),
    side: k.side,
    provider: k.provider,
    alive: k.alive,
    quotaPercent: k.quotaPercent ?? 100,
    quotaUpdatedAt: k.quotaUpdatedAt,
    modelCount: (k.availableModels || []).length,
    createdAt: k.createdAt,
  }));
}

async function getAllKeys(userId, guestSessionId) {
  const [left, right] = await Promise.all([
    getKeysBySide('left', userId, guestSessionId),
    getKeysBySide('right', userId, guestSessionId),
  ]);
  return { left, right };
}

module.exports = { getKeysBySide, getAllKeys };