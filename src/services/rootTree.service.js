/* ═══════════════════════════════════════════════════════════════
   🌳 ROOT TREE SERVICE
   - Đọc/ghi cây gốc
   - Duyệt nhánh
   - Kế thừa gen từ cha mẹ
   ═══════════════════════════════════════════════════════════════ */

const { getRootTreeModel } = require('../models/rootTree.model');
const logger = require('../utils/logger');

/* ═══════════════════════════════════════════════════════════════
   CÁC HÀM CƠ BẢN
   ═══════════════════════════════════════════════════════════════ */

/**
 * Lấy 1 nhánh theo id.
 */
async function layNhanh(id) {
  if (!id || typeof id !== 'string') return null;
  try {
    const RootTree = getRootTreeModel();
    return await RootTree.findOne({ id, isActive: true }).lean();
  } catch (err) {
    logger.warn(`layNhanh(${id}) lỗi: ${err.message}`);
    return null;
  }
}

/**
 * Lấy tất cả con của 1 nhánh.
 */
async function layCon(parentId) {
  if (!parentId) return [];
  try {
    const RootTree = getRootTreeModel();
    return await RootTree.find({ parent: parentId, isActive: true }).lean();
  } catch (err) {
    logger.warn(`layCon(${parentId}) lỗi: ${err.message}`);
    return [];
  }
}

/**
 * Kiểm nhánh tồn tại.
 */
async function coTonTai(id) {
  if (!id) return false;
  try {
    const RootTree = getRootTreeModel();
    const count = await RootTree.countDocuments({ id, isActive: true });
    return count > 0;
  } catch (err) {
    logger.warn(`coTonTai(${id}) lỗi: ${err.message}`);
    return false;
  }
}

/**
 * Lưu nhánh mới.
 */
async function luuNhanh(nhanh) {
  if (!nhanh || !nhanh.id) throw new Error('Nhánh thiếu id');

  try {
    const RootTree = getRootTreeModel();
    const existing = await RootTree.findOne({ id: nhanh.id });

    if (existing) {
      // Cập nhật
      Object.assign(existing, nhanh);
      await existing.save();
      logger.success(`✅ Cập nhật nhánh ${nhanh.id}`);
      return existing.toObject();
    }

    // Tạo mới
    const created = await RootTree.create(nhanh);
    logger.success(`✅ Tạo nhánh ${nhanh.id}`);
    return created.toObject();
  } catch (err) {
    logger.error(`luuNhanh(${nhanh.id}) lỗi: ${err.message}`);
    throw err;
  }
}

/**
 * Cập nhật con của nhánh cha (thêm con mới).
 */
async function themCon(parentId, childId) {
  if (!parentId || !childId) return null;
  try {
    const RootTree = getRootTreeModel();
    return await RootTree.updateOne(
      { id: parentId },
      { $addToSet: { children: childId } }
    );
  } catch (err) {
    logger.warn(`themCon lỗi: ${err.message}`);
    return null;
  }
}

/* ═══════════════════════════════════════════════════════════════
   DUYỆT CÂY — THEO PATH
   ═══════════════════════════════════════════════════════════════ */

/**
 * Duyệt cây theo đường dẫn.
 * VD path = ["math", "addition", "multiply"]
 * → trả nhánh cuối cùng nếu tồn tại
 * → trả thông tin nhánh thiếu nếu không đủ
 */
async function duyetCay(path) {
  if (!Array.isArray(path) || path.length === 0) {
    return { success: false, error: 'Path rỗng', missing: [] };
  }

  const result = {
    success: false,
    nhanh: null,
    missing: [],       // Danh sách path thiếu
    lastFound: null,   // Nhánh cuối cùng tìm thấy
  };

  let currentPath = '';

  for (let i = 0; i < path.length; i++) {
    currentPath = currentPath ? `${currentPath}.${path[i]}` : path[i];

    const nhanh = await layNhanh(currentPath);

    if (!nhanh) {
      // Thiếu nhánh từ đây về sau
      result.missing = path.slice(i).map((_, idx) =>
        currentPath.split('.').slice(0, i + idx + 1).join('.')
      );
      result.lastFound = i > 0 ? path.slice(0, i).join('.') : null;
      return result;
    }

    if (i === path.length - 1) {
      // Đã đến nhánh cuối
      result.success = true;
      result.nhanh = nhanh;
    }
  }

  return result;
}

/**
 * Duyệt cây — trả nhánh cuối + đường dẫn cha.
 */
async function duyetCayFull(path) {
  if (!Array.isArray(path) || path.length === 0) {
    return { success: false, error: 'Path rỗng' };
  }

  const result = {
    success: false,
    nhanh: null,
    missingAt: -1,
    lastFound: null,
    lastFoundPath: null,
  };

  let currentPath = '';

  for (let i = 0; i < path.length; i++) {
    currentPath = currentPath ? `${currentPath}.${path[i]}` : path[i];
    const nhanh = await layNhanh(currentPath);

    if (!nhanh) {
      result.missingAt = i;
      result.lastFound = i > 0 ? await layNhanh(path.slice(0, i).join('.')) : null;
      result.lastFoundPath = i > 0 ? path.slice(0, i).join('.') : null;
      return result;
    }

    if (i === path.length - 1) {
      result.success = true;
      result.nhanh = nhanh;
    }
  }

  return result;
}

/* ═══════════════════════════════════════════════════════════════
   KẾ THỪA GEN TỪ CHA MẸ
   ═══════════════════════════════════════════════════════════════ */

/**
 * Lấy trường từ nhánh — nếu không có → duyệt lên cha.
 * Dùng đệ quy.
 */
async function layTruongKeThua(nhanhId, field) {
  if (!nhanhId || !field) return null;

  const nhanh = await layNhanh(nhanhId);
  if (!nhanh) return null;

  if (nhanh[field] && String(nhanh[field]).trim() !== '') {
    return nhanh[field];
  }

  if (nhanh.parent && nhanh.parent !== 'root') {
    return await layTruongKeThua(nhanh.parent, field);
  }

  return null;
}

/**
 * Lấy 14 trường nội dung — kế thừa từ cha mẹ nếu cần.
 */
async function lay14Truong(nhanhId) {
  const FIELDS = [
    'nguyenLy', 'quyTac', 'dieuKien', 'cayQuyetDinh',
    'phuongPhap', 'thuatToan', 'workflow', 'suyLuan',
    'testCase', 'kiemChung', 'ngoaiLe', 'caseKinhNghiem',
    'quanHe', 'nguonPhienBan',
  ];

  const result = {};
  for (const field of FIELDS) {
    result[field] = await layTruongKeThua(nhanhId, field);
  }
  return result;
}

/* ═══════════════════════════════════════════════════════════════
   THỐNG KÊ
   ═══════════════════════════════════════════════════════════════ */

async function thongKeCay() {
  try {
    const RootTree = getRootTreeModel();
    const total = await RootTree.countDocuments({ isActive: true });
    const byDepth = await RootTree.aggregate([
      { $match: { isActive: true } },
      { $group: { _id: '$depth', count: { $sum: 1 } } },
      { $sort: { _id: 1 } },
    ]);
    const byCategory = await RootTree.aggregate([
      { $match: { isActive: true } },
      { $group: { _id: '$category', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]);
    return { total, byDepth, byCategory };
  } catch (err) {
    logger.warn(`thongKeCay lỗi: ${err.message}`);
    return { total: 0, byDepth: [], byCategory: [] };
  }
}

/**
 * Tăng usage/success/fail.
 */
async function tangUsage(nhanhId, type = 'usage') {
  if (!nhanhId) return;
  try {
    const RootTree = getRootTreeModel();
    const field = type === 'success' ? 'successCount' :
                  type === 'fail' ? 'failCount' : 'usageCount';
    await RootTree.updateOne(
      { id: nhanhId },
      { $inc: { [field]: 1 }, $set: { lastUsedAt: new Date() } }
    );
  } catch (err) {
    logger.warn(`tangUsage lỗi: ${err.message}`);
  }
}

module.exports = {
  layNhanh,
  layCon,
  coTonTai,
  luuNhanh,
  themCon,
  duyetCay,
  duyetCayFull,
  layTruongKeThua,
  lay14Truong,
  thongKeCay,
  tangUsage,
};