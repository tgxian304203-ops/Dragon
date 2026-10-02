/* ═══════════════════════════════════════════════════════════════
   🧩 ĐÁNH GIÁ TIP — Kiểm 14 trường (I5b-1)
   ═══════════════════════════════════════════════════════════════ */

const logger = require('../utils/logger');

const FIELDS_14 = [
  'nguyenLy', 'quyTac', 'dieuKien', 'cayQuyetDinh',
  'phuongPhap', 'thuatToan', 'workflow', 'suyLuan',
  'testCase', 'kiemChung', 'ngoaiLe', 'caseKinhNghiem',
  'quanHe', 'nguonPhienBan',
];

function danhGiaTIP(tip) {
  if (!tip || typeof tip !== 'object') {
    return { day: false, missing: [...FIELDS_14], empty: [], filledCount: 0, totalCount: 14, completeness: 0 };
  }

  const missing = [];
  const empty = [];
  let filledCount = 0;

  for (const field of FIELDS_14) {
    if (!(field in tip)) { missing.push(field); continue; }

    const value = tip[field];

    if (Array.isArray(value)) {
      if (value.length === 0) empty.push(field);
      else filledCount++;
      continue;
    }

    const str = typeof value === 'string' ? value.trim() : String(value || '').trim();
    if (str === '' || str.toLowerCase() === 'chưa xác định') empty.push(field);
    else filledCount++;
  }

  const completeness = Math.round((filledCount / FIELDS_14.length) * 100);
  const day = missing.length === 0 && empty.length === 0 && filledCount === 14;

  if (!day) {
    logger.debug(`TIP chưa đủ: missing=[${missing.join(',')}], empty=[${empty.join(',')}] — ${completeness}%`);
  }

  return { day, missing, empty, filledCount, totalCount: 14, completeness };
}

module.exports = { danhGiaTIP, FIELDS_14 };