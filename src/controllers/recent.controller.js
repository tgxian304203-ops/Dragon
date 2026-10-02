/* ═══════════════════════════════════════════════════════════════
   🕐 RECENT CONTROLLER (RC1–RC3)
   ═══════════════════════════════════════════════════════════════ */

const Conversation = require('../models/conversation.model');

function getOwner(req) {
  if (req.user && req.user.userId) return { userId: req.user.userId, guestSessionId: null };
  if (req.guest && req.guest.sessionId) return { userId: null, guestSessionId: req.guest.sessionId };
  return null;
}

async function list(req, res) {
  const owner = getOwner(req);
  if (!owner) return res.json({ items: [] });

  const query = owner.userId
    ? { userId: owner.userId }
    : { guestSessionId: owner.guestSessionId };

  const items = await Conversation.find(query)
    .sort({ lastMessageAt: -1 })
    .limit(10)
    .lean();

  res.json({
    items: items.map((c) => ({
      id: c._id.toString(),
      title: c.title,
      messageCount: c.messageCount,
      lastMessageAt: c.lastMessageAt,
      projectId: c.projectId?.toString() || null,
    })),
  });
}

module.exports = { list };