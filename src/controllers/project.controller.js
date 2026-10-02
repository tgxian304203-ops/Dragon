/* ═══════════════════════════════════════════════════════════════
   📁 PROJECT CONTROLLER (PJ1–PJ6)
   ═══════════════════════════════════════════════════════════════ */

const Project = require('../models/project.model');
const Conversation = require('../models/conversation.model');
const validator = require('../utils/validator');

function getOwner(req) {
  if (req.user && req.user.userId) return { userId: req.user.userId, guestSessionId: null };
  if (req.guest && req.guest.sessionId) return { userId: null, guestSessionId: req.guest.sessionId };
  return null;
}

async function list(req, res) {
  const owner = getOwner(req);
  if (!owner) return res.json({ items: [] });

  const query = owner.userId ? { userId: owner.userId } : { guestSessionId: owner.guestSessionId };
  const items = await Project.find(query).sort({ createdAt: -1 }).lean();

  res.json({
    items: items.map((p) => ({
      id: p._id.toString(),
      name: p.name,
      description: p.description,
      conversationCount: p.conversationCount,
      createdAt: p.createdAt,
    })),
  });
}

async function create(req, res) {
  const owner = getOwner(req);
  if (!owner) return res.status(401).json({ error: 'Cần đăng nhập hoặc guest session' });

  const { name, description } = req.body || {};
  if (!validator.isText(name, 200)) return res.status(400).json({ error: 'Tên không hợp lệ' });

  const project = await Project.create({
    userId: owner.userId,
    guestSessionId: owner.guestSessionId,
    name: name.trim(),
    description: (description || '').slice(0, 2000),
  });

  res.status(201).json({
    project: {
      id: project._id.toString(),
      name: project.name,
      description: project.description,
      conversationCount: 0,
      createdAt: project.createdAt,
    },
  });
}

async function rename(req, res) {
  const owner = getOwner(req);
  if (!owner) return res.status(401).json({ error: 'Cần đăng nhập hoặc guest session' });

  const { id } = req.params;
  const { name } = req.body || {};

  if (!validator.isObjectId(id)) return res.status(400).json({ error: 'ID không hợp lệ' });
  if (!validator.isText(name, 200)) return res.status(400).json({ error: 'Tên không hợp lệ' });

  const query = { _id: id };
  if (owner.userId) query.userId = owner.userId;
  else query.guestSessionId = owner.guestSessionId;

  const project = await Project.findOneAndUpdate(
    query, { $set: { name: name.trim() } }, { new: true }
  ).lean();

  if (!project) return res.status(404).json({ error: 'Không tìm thấy dự án' });
  res.json({ project: { id: project._id.toString(), name: project.name } });
}

async function remove(req, res) {
  const owner = getOwner(req);
  if (!owner) return res.status(401).json({ error: 'Cần đăng nhập hoặc guest session' });

  const { id } = req.params;
  if (!validator.isObjectId(id)) return res.status(400).json({ error: 'ID không hợp lệ' });

  const query = { _id: id };
  if (owner.userId) query.userId = owner.userId;
  else query.guestSessionId = owner.guestSessionId;

  const project = await Project.findOneAndDelete(query).lean();
  if (!project) return res.status(404).json({ error: 'Không tìm thấy dự án' });

  await Conversation.updateMany({ projectId: id }, { $set: { projectId: null } });
  res.json({ success: true, deletedId: id });
}

async function moveConversation(req, res) {
  const owner = getOwner(req);
  if (!owner) return res.status(401).json({ error: 'Cần đăng nhập hoặc guest session' });

  const { id } = req.params;
  const { conversationId } = req.body || {};

  if (!validator.isObjectId(id)) return res.status(400).json({ error: 'Project ID không hợp lệ' });
  if (!validator.isObjectId(conversationId)) return res.status(400).json({ error: 'Conversation ID không hợp lệ' });

  const ownerQuery = owner.userId
    ? { userId: owner.userId }
    : { guestSessionId: owner.guestSessionId };

  const project = await Project.findOne({ _id: id, ...ownerQuery }).lean();
  if (!project) return res.status(404).json({ error: 'Không tìm thấy dự án' });

  const oldConv = await Conversation.findOne({ _id: conversationId, ...ownerQuery }).lean();
  if (!oldConv) return res.status(404).json({ error: 'Không tìm thấy conversation' });

  const oldProjectId = oldConv.projectId;

  await Conversation.updateOne(
    { _id: conversationId },
    { $set: { projectId: id } }
  );

  const newCount = await Conversation.countDocuments({ projectId: id });
  await Project.updateOne({ _id: id }, { $set: { conversationCount: newCount } });

  if (oldProjectId && String(oldProjectId) !== String(id)) {
    const oldCount = await Conversation.countDocuments({ projectId: oldProjectId });
    await Project.updateOne({ _id: oldProjectId }, { $set: { conversationCount: oldCount } });
  }

  res.json({ success: true });
}

module.exports = { list, create, rename, remove, moveConversation };