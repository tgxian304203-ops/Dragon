/* ═══════════════════════════════════════════════════════════════
   📊 QUOTA SERVICE
   - Trả danh sách key cho UI menu phải
   - Dùng layQuotaHieuDung để khớp với logic não (goiModel.js)
   - Trả thêm conLaiMs + status cho UI hiển thị trạng thái
   ═══════════════════════════════════════════════════════════════ */

const BrainKey = require('../models/brainKey.model');
const { layQuotaHieuDung, tinhConLaiMs } = require('../core/brains/quotaTracker');

async function getKeysBySide(side, userId, guestSessionId) {
  const query = { side, alive: true };
  if (userId) query.userId = userId;
  else if (guestSessionId) query.guestSessionId = guestSessionId;
  else return [];

  const keys = await BrainKey.find(query).sort({ createdAt: 1 }).lean();

  return keys.map((k) => {
    const quotaHieuDung = layQuotaHieuDung(k);
    const conLaiMs = tinhConLaiMs(k);

    let status = 'dang_dung';
    if (!k.alive) status = 'chet';
    else if (quotaHieuDung === 0) status = 'cho_hoi';

    return {
      id: k._id.toString(),
      side: k.side,
      provider: k.provider,
      alive: k.alive,
      quotaPercent: quotaHieuDung,
      quotaPercentRaw: k.quotaPercent ?? 100,
      quotaUpdatedAt: k.quotaUpdatedAt,
      conLaiMs,
      status,
      modelCount: (k.availableModels || []).length,
      createdAt: k.createdAt,
    };
  });
}

async function getAllKeys(userId, guestSessionId) {
  const [left, right] = await Promise.all([
    getKeysBySide('left', userId, guestSessionId),
    getKeysBySide('right', userId, guestSessionId),
  ]);
  return { left, right };
}

module.exports = { getKeysBySide, getAllKeys };