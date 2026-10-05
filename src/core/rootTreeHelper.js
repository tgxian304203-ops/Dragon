/* ═══════════════════════════════════════════════════════════════
   🌳 ROOT TREE HELPER
   - Phân tích câu hỏi → đường dẫn nhánh
   - Map phép tính / ngôn ngữ → path
   ═══════════════════════════════════════════════════════════════ */

const logger = require('../utils/logger');

/* ═══════════════════════════════════════════════════════════════
   MAP PHÉP TÍNH → NHÁNH
   ═══════════════════════════════════════════════════════════════ */

const PHEP_TOAN_MAP = [
  { keywords: ['cộng', 'tổng', '+', 'cong', 'add', 'plus'], path: 'addition' },
  { keywords: ['nhân', 'tích', '*', 'x', '×', 'nhan', 'multiply', 'times'], path: 'multiplication' },
  { keywords: ['trừ', 'hiệu', '-', 'tru', 'minus', 'subtract'], path: 'subtraction' },
  { keywords: ['chia', 'thương', '/', 'divide'], path: 'division' },
  { keywords: ['mũ', 'lũy thừa', '^', 'power', 'exponent'], path: 'power' },
];

const LANG_MAP = {
  html: 'web',
  css: 'web',
  javascript: 'web',
  js: 'web',
  python: 'script',
  py: 'script',
  node: 'script',
  'react-native': 'mobile',
  flutter: 'mobile',
};

/* ═══════════════════════════════════════════════════════════════
   PHÂN TÍCH CÂU HỎI → PATH NHÁNH
   ═══════════════════════════════════════════════════════════════ */

/**
 * Phát hiện các phép toán trong câu hỏi.
 * VD: "2 cộng 2 nhân 3" → ["addition", "multiplication"]
 */
function phatHienPhepToan(problem) {
  const q = String(problem).toLowerCase();
  const found = [];

  for (const item of PHEP_TOAN_MAP) {
    for (const kw of item.keywords) {
      const re = new RegExp(`(^|\\s)${kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(\\s|$)`, 'i');
      if (re.test(q)) {
        if (!found.includes(item.path)) found.push(item.path);
        break;
      }
    }
  }

  return found;
}

/**
 * Phát hiện ngôn ngữ code trong câu hỏi.
 */
function phatHienNgonNgu(problem) {
  const q = String(problem).toLowerCase();
  for (const [key, value] of Object.entries(LANG_MAP)) {
    if (new RegExp(`\\b${key}\\b`, 'i').test(q)) return { lang: key, group: value };
  }
  return { lang: null, group: null };
}

/**
 * Phát hiện intent code (create/find-bug/fix-bug).
 */
function phatHienIntentCode(problem) {
  const q = String(problem).toLowerCase();
  if (/\b(sửa|fix|patch|khắc phục|debug)\b/i.test(q)) return 'fix-bug';
  if (/\b(tìm bug|kiểm tra lỗi|có lỗi gì|bug ở đâu)\b/i.test(q)) return 'find-bug';
  if (/\b(viết|tạo|code|lập trình|xây dựng)\b/i.test(q)) return 'create';
  return null;
}

/**
 * Tạo đường dẫn nhánh từ câu hỏi.
 * VD: "2 cộng 2 nhân 3" → ["math", "addition", "multiplication"]
 *     "tạo web shop" → ["code", "create", "web", "html"]
 */
function taoPathNhanh(problem) {
  const q = String(problem).toLowerCase();
  const path = [];

  // 1. Detect nhánh gốc
  const pheps = phatHienPhepToan(problem);
  const { group: langGroup } = phatHienNgonNgu(problem);
  const intentCode = phatHienIntentCode(problem);

  if (pheps.length > 0) {
    // Toán
    path.push('math');
    path.push(...pheps);
    return path;
  }

  if (intentCode && langGroup) {
    // Code
    path.push('code');
    path.push(intentCode);
    path.push(langGroup);
    // HTML cấp cuối
    const { lang } = phatHienNgonNgu(problem);
    if (lang === 'html') path.push('html');
    else if (lang === 'python') path.push('python');
    else if (lang === 'javascript' || lang === 'js' || lang === 'node') path.push('javascript');
    return path;
  }

  if (/\b(viết|tạo|code|lập trình)\b/.test(q) && langGroup) {
    // Code không rõ intent → mặc định create
    path.push('code');
    path.push('create');
    path.push(langGroup);
    const { lang } = phatHienNgonNgu(problem);
    if (lang === 'html') path.push('html');
    else if (lang === 'python') path.push('python');
    else if (lang === 'javascript' || lang === 'js' || lang === 'node') path.push('javascript');
    return path;
  }

  if (/\b(thơ|lục bát|thất ngôn|tự do)\b/.test(q)) {
    path.push('van');
    path.push('thơ');
    if (/lục bát/.test(q)) path.push('lục-bát');
    else if (/thất ngôn/.test(q)) path.push('thất-ngôn');
    else if (/tự do/.test(q)) path.push('tự-do');
    return path;
  }

  if (/\b(tả|miêu tả|văn tả)\b/.test(q)) {
    path.push('van');
    path.push('văn-xuôi');
    path.push('tả');
    return path;
  }

  if (/\b(kể|tự sự)\b/.test(q)) {
    path.push('van');
    path.push('văn-xuôi');
    path.push('kể');
    return path;
  }

  if (/\b(phân tích)\b/.test(q)) {
    path.push('van');
    path.push('phân-tích');
    return path;
  }

  if (/\b(nghị luận|chứng minh)\b/.test(q)) {
    path.push('van');
    path.push('nghị-luận');
    return path;
  }

  if (/\b(ngữ pháp|chính tả)\b/.test(q)) {
    path.push('van');
    path.push('ngữ-pháp');
    return path;
  }

  if (/\b(giải thích|tại sao|là gì|khái niệm)\b/.test(q)) {
    path.push('explain');
    if (/toán|số/.test(q)) path.push('math-concept');
    else if (/code|hàm/.test(q)) path.push('code-concept');
    else path.push('general-concept');
    return path;
  }

  // Fallback
  logger.debug(`Không detect được nhánh cho: "${problem.slice(0, 60)}"`);
  return [];
}

/**
 * Tạo path đầy đủ bao gồm tất cả tổ tiên.
 * VD: ["math", "addition", "multiplication"] → ["math", "math.addition", "math.addition.multiply"]
 */
function pathToIds(pathParts) {
  if (!Array.isArray(pathParts) || pathParts.length === 0) return [];
  const ids = [];
  let current = '';
  for (const p of pathParts) {
    current = current ? `${current}.${p}` : p;
    ids.push(current);
  }
  return ids;
}

/* ═══════════════════════════════════════════════════════════════
   MAP PHÉP TOÁN — DÙNG CHO TÊN NHÁNH CON
   ═══════════════════════════════════════════════════════════════ */

/**
 * Với "cộng nhân" → cha là "math.addition", con là "multiply"
 * Với "nhân cộng" → cha là "math.multiplication", con là "add"
 */
function mapPhepToanSangNhanh(phep) {
  const map = {
    addition: 'addition',
    multiplication: 'multiply',
    subtraction: 'subtract',
    division: 'divide',
    power: 'power',
  };
  return map[phep] || phep;
}

module.exports = {
  phatHienPhepToan,
  phatHienNgonNgu,
  phatHienIntentCode,
  taoPathNhanh,
  pathToIds,
  mapPhepToanSangNhanh,
  PHEP_TOAN_MAP,
  LANG_MAP,
};