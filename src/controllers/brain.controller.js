/* ═══════════════════════════════════════════════════════════════
   🔑 BRAIN CONTROLLER — CHỈ user đăng nhập mới lưu key
   ═══════════════════════════════════════════════════════════════ */

const BrainKey = require('../models/brainKey.model');
const quotaService = require('../services/quota.service');
const { detectProvider } = require('../core/brains/detectProvider');
const { validateKey } = require('../core/brains/validateKey');
const { doModel } = require('../core/brains/doModel');
const modelCache = require('../core/brains/modelCache');
const validator = require('../utils/validator');
const logger = require('../utils/logger');

/* POST /api/brain/key — chỉ user login */
async function addKey(req, res) {
  if (!req.user || !req.user.userId) {
    return res.status(401).json({ error: 'Cần đăng nhập để lưu key' });
  }

  const userId = req.user.userId;
  const { side, key } = req.body || {};

  if (!validator.isSide(side)) return res.status(400).json({ error: 'side phải là left/right' });
  if (typeof key !== 'string' || key.trim().length < 10) {
    return res.status(400).json({ error: 'Key không hợp lệ' });
  }

  const trimmedKey = key.trim();

  const otherSide = side === 'left' ? 'right' : 'left';
  const usedOther = await BrainKey.findOne({
    keyValue: trimmedKey, side: otherSide, userId,
  }).lean();

  if (usedOther) {
    return res.status(409).json({
      error: `Key đã dùng ở Não ${otherSide === 'left' ? 'trái' : 'phải'} — không được dùng chung (H9)`,
    });
  }

  const exists = await BrainKey.findOne({ keyValue: trimmedKey, side, userId }).lean();
  if (exists) return res.status(409).json({ error: 'Key đã có trong Não này' });

  let provider;
  try {
    const detected = await detectProvider(trimmedKey);
    provider = detected.provider;
  } catch (err) {
    return res.status(400).json({ error: 'Không nhận diện được provider: ' + err.message });
  }

  const validation = await validateKey(provider, trimmedKey);

  let availableModels = [];
  if (validation.alive) {
    try {
      const { models } = await doModel(provider, trimmedKey);
      availableModels = models;
    } catch (err) {
      logger.warn(`Dò model lỗi: ${err.message}`);
    }
  }

  const newKey = await BrainKey.create({
    userId,
    guestSessionId: null,
    side, provider, keyValue: trimmedKey,
    alive: validation.alive,
    availableModels,
    quotaPercent: 100,
    quotaUpdatedAt: new Date(),
  });

  if (validation.alive && availableModels.length > 0) {
    modelCache.set(side, String(newKey._id), availableModels);
  }

  logger.success(`Thêm key ${side}/${provider} — alive=${validation.alive}, ${availableModels.length} model`);

  const response = {
    key: {
      id: newKey._id.toString(),
      side: newKey.side,
      provider: newKey.provider,
      alive: newKey.alive,
      quotaPercent: newKey.quotaPercent,
      modelCount: availableModels.length,
      createdAt: newKey.createdAt,
    },
  };

  if (!validation.alive) response.warning = `Key đã lưu nhưng không hoạt động: ${validation.error || 'không xác định'}`;
  else if (availableModels.length === 0) response.warning = 'Key hoạt động nhưng không dò được model FREE nào';

  res.status(201).json(response);
}

/* GET /api/brain/run */
async function listKeys(req, res) {
  if (!req.user || !req.user.userId) {
    return res.json({ left: [], right: [] });
  }

  const data = await quotaService.getAllKeys(req.user.userId, null);
  res.json(data);
}

/* DELETE /api/brain/key/:id */
async function deleteKey(req, res) {
  if (!req.user || !req.user.userId) {
    return res.status(401).json({ error: 'Cần đăng nhập để xóa key' });
  }

  const userId = req.user.userId;
  const { id } = req.params;
  if (!validator.isObjectId(id)) return res.status(400).json({ error: 'ID không hợp lệ' });

  const existing = await BrainKey.findOne({ _id: id, userId }).lean();
  if (!existing) return res.status(404).json({ error: 'Không tìm thấy key' });

  await BrainKey.deleteOne({ _id: id });
  modelCache.clear(existing.side, String(id));

  logger.info(`Xóa key ${id} (${existing.side}/${existing.provider})`);
  res.json({ success: true, deletedId: id });
}

module.exports = { addKey, listKeys, deleteKey };