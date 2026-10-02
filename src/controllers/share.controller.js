/* ═══════════════════════════════════════════════════════════════
   🔗 SHARE CONTROLLER (SH1–SH6)
   ═══════════════════════════════════════════════════════════════ */

const shareService = require('../services/share.service');
const validator = require('../utils/validator');

function getOwner(req) {
  if (req.user && req.user.userId) return { userId: req.user.userId, guestSessionId: null };
  if (req.guest && req.guest.sessionId) return { userId: null, guestSessionId: req.guest.sessionId };
  return null;
}

async function create(req, res) {
  const owner = getOwner(req);
  if (!owner) return res.status(401).json({ error: 'Cần đăng nhập hoặc guest session' });

  const { conversationId } = req.body || {};
  if (!validator.isObjectId(conversationId)) {
    return res.status(400).json({ error: 'conversationId không hợp lệ' });
  }

  try {
    const result = await shareService.createShare({
      conversationId,
      userId: owner.userId,
      guestSessionId: owner.guestSessionId,
    });
    res.status(201).json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

async function list(req, res) {
  const owner = getOwner(req);
  if (!owner) return res.json({ items: [] });

  const items = await shareService.listShares(owner.userId, owner.guestSessionId);
  res.json({ items });
}

async function remove(req, res) {
  const owner = getOwner(req);
  if (!owner) return res.status(401).json({ error: 'Cần đăng nhập hoặc guest session' });

  const { conversationId } = req.params;
  if (!validator.isObjectId(conversationId)) {
    return res.status(400).json({ error: 'ID không hợp lệ' });
  }

  try {
    const result = await shareService.deleteShare({
      conversationId,
      userId: owner.userId,
      guestSessionId: owner.guestSessionId,
    });
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

async function view(req, res) {
  const { slug } = req.params;
  if (!slug || typeof slug !== 'string') {
    return res.status(400).json({ error: 'Slug không hợp lệ' });
  }

  try {
    const data = await shareService.getShareBySlug(slug);
    res.json(data);
  } catch (err) {
    res.status(404).json({ error: err.message });
  }
}

module.exports = { create, list, remove, view };