/* ═══════════════════════════════════════════════════════════════
   🧩 ĐÁNH GIÁ TIP — Kiểm 14 trường JSON structured
   ═══════════════════════════════════════════════════════════════ */

const logger = require('../utils/logger');

const FIELDS_14 = [
  'nguyenLy', 'quyTac', 'dieuKien', 'cayQuyetDinh',
  'phuongPhap', 'thuatToan', 'workflow', 'suyLuan',
  'testCase', 'kiemChung', 'ngoaiLe', 'caseKinhNghiem',
  'quanHe', 'nguonPhienBan',
];

// Schema từng trường
const SCHEMA = {
  nguyenLy:       { type: 'string', required: true },
  quyTac:         { type: 'arrayString' },
  dieuKien:       { type: 'arrayDieuKien' },
  cayQuyetDinh:   { type: 'objectNullable' },
  phuongPhap:     { type: 'string' },
  thuatToan:      { type: 'arrayStep' },
  workflow:       { type: 'objectNullable' },
  suyLuan:        { type: 'arrayString' },
  testCase:       { type: 'arrayTestCase', required: true },
  kiemChung:      { type: 'objectNullable' },
  ngoaiLe:        { type: 'arrayNgoaiLe' },
  caseKinhNghiem: { type: 'arrayString' },
  quanHe:         { type: 'arrayString' },
  nguonPhienBan:  { type: 'string' },
};

/**
 * Kiểm 1 trường có đúng schema không
 */
function checkField(field, value) {
  const s = SCHEMA[field];
  if (!s) return { ok: true };

  switch (s.type) {
    case 'string':
      if (s.required && (typeof value !== 'string' || value.trim() === '')) {
        return { ok: false, reason: 'phải là chuỗi không rỗng' };
      }
      if (value && typeof value !== 'string') {
        return { ok: false, reason: 'phải là chuỗi' };
      }
      return { ok: true };

    case 'arrayString':
      if (!Array.isArray(value)) {
        return { ok: false, reason: 'phải là mảng' };
      }
      return { ok: true };

    case 'arrayDieuKien':
      if (!Array.isArray(value)) {
        return { ok: false, reason: 'phải là mảng' };
      }
      for (const d of value) {
        if (!d || typeof d !== 'object') return { ok: false, reason: 'phần tử phải là object' };
        if (!d.var || !d.op) return { ok: false, reason: 'thiếu var hoặc op' };
        if (!['==', '!=', '>', '>=', '<', '<='].includes(d.op)) {
          return { ok: false, reason: `op không hợp lệ: ${d.op}` };
        }
      }
      return { ok: true };

    case 'objectNullable':
      if (value === null || value === undefined) return { ok: true };
      if (typeof value !== 'object' || Array.isArray(value)) {
        return { ok: false, reason: 'phải là object hoặc null' };
      }
      return { ok: true };

    case 'arrayStep':
      if (!Array.isArray(value)) {
        return { ok: false, reason: 'phải là mảng' };
      }
      for (const st of value) {
        if (!st || typeof st !== 'object') return { ok: false, reason: 'phần tử phải là object' };
        if (!st.op) return { ok: false, reason: 'thiếu op' };
        if (!['compute', 'check', 'return'].includes(st.op)) {
          return { ok: false, reason: `op không hợp lệ: ${st.op}` };
        }
      }
      return { ok: true };

    case 'arrayTestCase':
      if (!Array.isArray(value)) {
        return { ok: false, reason: 'phải là mảng' };
      }
      if (s.required && value.length === 0) {
        return { ok: false, reason: 'phải có ít nhất 1 test case' };
      }
      for (const tc of value) {
        if (!tc || typeof tc !== 'object') return { ok: false, reason: 'phần tử phải là object' };
        if (!tc.input) return { ok: false, reason: 'thiếu input' };
        if (tc.expected === undefined) return { ok: false, reason: 'thiếu expected' };
      }
      return { ok: true };

    case 'arrayNgoaiLe':
      if (!Array.isArray(value)) {
        return { ok: false, reason: 'phải là mảng' };
      }
      for (const e of value) {
        if (!e || typeof e !== 'object') return { ok: false, reason: 'phần tử phải là object' };
        if (!e.when) return { ok: false, reason: 'thiếu when' };
      }
      return { ok: true };

    default:
      return { ok: true };
  }
}

/**
 * Đánh giá TIP đầy đủ
 */
function danhGiaTIP(tip) {
  if (!tip || typeof tip !== 'object') {
    return {
      day: false,
      missing: [...FIELDS_14],
      empty: [],
      schemaErrors: [],
      filledCount: 0,
      totalCount: 14,
      completeness: 0,
    };
  }

  const missing = [];
  const empty = [];
  const schemaErrors = [];
  let filledCount = 0;

  for (const field of FIELDS_14) {
    if (!(field in tip)) {
      missing.push(field);
      continue;
    }

    const value = tip[field];

    // Check rỗng
    if (value === null || value === undefined) {
      empty.push(field);
      continue;
    }

    if (typeof value === 'string' && value.trim() === '') {
      empty.push(field);
      continue;
    }

    if (Array.isArray(value) && value.length === 0) {
      // Mảng rỗng — chấp nhận cho vài trường không bắt buộc
      const s = SCHEMA[field];
      if (s && s.required) {
        empty.push(field);
        continue;
      }
      // Không required → OK
      filledCount++;
      continue;
    }

    // Check schema
    const check = checkField(field, value);
    if (!check.ok) {
      schemaErrors.push({ field, reason: check.reason });
      continue;
    }

    filledCount++;
  }

  const completeness = Math.round((filledCount / FIELDS_14.length) * 100);
  const day = missing.length === 0 &&
              empty.length === 0 &&
              schemaErrors.length === 0 &&
              filledCount === 14;

  if (!day) {
    logger.debug(
      `TIP chưa đủ: missing=[${missing.join(',')}], ` +
      `empty=[${empty.join(',')}], schemaErrors=${schemaErrors.length} — ${completeness}%`
    );
  }

  return {
    day,
    missing,
    empty,
    schemaErrors,
    filledCount,
    totalCount: 14,
    completeness,
  };
}

module.exports = { danhGiaTIP, FIELDS_14, SCHEMA, checkField };