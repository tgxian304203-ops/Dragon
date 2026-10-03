/* ═══════════════════════════════════════════════════════════════
   🎯 LOGIC RUNNER — Match pattern LINH HOẠT + chạy logic (async)
   - Normalize mạnh: viết thường, bỏ dấu câu, dedupe
   - Bỏ stopwords toàn diện (đầu/giữa/cuối)
   - Bảng sửa chính tả phổ biến
   - Fuzzy match (Levenshtein) — chạy JS thuần
   - Nhánh expr: mathjs | Nhánh code/patch: Judge0
   ═══════════════════════════════════════════════════════════════ */

const { evaluate } = require('mathjs');
const { testCode } = require('./pistonTest');
const logger = require('../utils/logger');

/* ═══════════════════════════════════════════════════════════════
   STOPWORDS — bỏ khi match (mọi vị trí)
   ═══════════════════════════════════════════════════════════════ */

const STOPWORDS = new Set([
  // Đệm yêu cầu
  'tính', 'giúp', 'giùm', 'hộ', 'dùm', 'cho', 'hỏi', 'xem', 'thử',
  'làm', 'ơn', 'với', 'và', 'của', 'thì', 'mà', 'để', 'được',
  // Đệm câu hỏi
  'là', 'bao', 'nhiêu', 'mấy', 'bằng', 'kết', 'quả', 'cho', 'biết',
  'vậy', 'ạ', 'à', 'nhé', 'nha', 'nào', 'gì', 'sao', 'đâu', 'khi',
  // Đại từ
  'tôi', 'mình', 'em', 'anh', 'chị', 'bạn', 'ta', 'tớ',
  // Đệm tiếng Anh
  'please', 'help', 'calculate', 'compute', 'what', 'is', 'the',
  // Ký tự vô nghĩa
  '?', '!', '.', ',', ';', ':',
]);

/* ═══════════════════════════════════════════════════════════════
   BẢNG SỬA CHÍNH TẢ — hardcode, không gọi model
   ═══════════════════════════════════════════════════════════════ */

const SPELL_FIX = {
  // Phép tính — không dấu
  'nhan': 'nhân',
  'nhân': 'nhân',
  'cong': 'cộng',
  'công': 'cộng',
  'tru': 'trừ',
  'trừ': 'trừ',
  'chia': 'chia',
  'chi': 'chia',
  'mu': 'mũ',
  'luy thua': 'lũy thừa',
  'luyThua': 'lũy thừa',
  'tong': 'tổng',
  'hieu': 'hiệu',
  'tich': 'tích',
  'thuong': 'thương',

  // Đệm — không dấu
  'tinh': 'tính',
  'giup': 'giúp',
  'gium': 'giùm',
  'ho': 'hộ',
  'dum': 'dùm',
  'bao nhieu': 'bao nhiêu',
  'bang may': 'bằng mấy',
  'ket qua': 'kết quả',

  // Code — không dấu
  'viet': 'viết',
  'tao': 'tạo',
  'ham': 'hàm',
  'code': 'code',
  'lap trinh': 'lập trình',
  'chuong trinh': 'chương trình',
  'sua': 'sửa',
  'loi': 'lỗi',
  'debug': 'debug',

  // Số
  'khong': 'không',
  'mot': 'một',
  'hai': 'hai',
  'ba': 'ba',
  'bon': 'bốn',
  'nam': 'năm',
  'sau': 'sáu',
  'bay': 'bảy',
  'tam': 'tám',
  'chin': 'chín',
  'muoi': 'mười',
  'phay': 'phẩy',
  'cham': 'chấm',
};

/* ═══════════════════════════════════════════════════════════════
   NORMALIZE — chuẩn hóa câu hỏi
   ═══════════════════════════════════════════════════════════════ */

/**
 * Bỏ dấu tiếng Việt khỏi 1 chuỗi (để so sánh).
 * "nhân" → "nhan", "cộng" → "cong"
 */
function removeDiacritics(str) {
  if (!str) return '';
  return String(str)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D');
}

/**
 * Sửa chính tả — áp dụng bảng SPELL_FIX.
 */
function fixSpelling(text) {
  if (!text) return '';
  let s = String(text).toLowerCase();

  // Sắp từ dài trước để tránh bỏ sót
  const keys = Object.keys(SPELL_FIX).sort((a, b) => b.length - a.length);

  for (const wrong of keys) {
    const correct = SPELL_FIX[wrong];
    const re = new RegExp(`(^|\\s)${wrong.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(\\s|$)`, 'giu');
    s = s.replace(re, `$1${correct}$2`);
  }

  return s;
}

/**
 * Chuẩn hóa câu hỏi:
 * 1. Viết thường
 * 2. Sửa chính tả qua bảng
 * 3. Thêm space quanh toán tử
 * 4. Chuẩn hóa số: 7,6 → 7.6 (giữ dấu phẩy cho hiển thị sau)
 * 5. Bỏ ký tự lạ
 * 6. Bỏ stopwords (đầu/giữa/cuối)
 * 7. Gộp space
 */
function normalizeQuery(query) {
  if (!query || typeof query !== 'string') return '';

  let s = query.trim();

  /* 1. Viết thường */
  s = s.toLowerCase();

  /* 2. Sửa chính tả */
  s = fixSpelling(s);

  /* 3. Thêm space quanh toán tử: "5+5" → "5 + 5" */
  s = s.replace(/(\d)\s*([+\-*/^=])\s*(\d)/g, '$1 $2 $3');

  /* 4. Chuẩn hóa số: 7,6 → 7.6 (tạm) */
  s = s.replace(/(\d),(\d)/g, '$1.$2');

  /* 5. Bỏ ký tự lạ (giữ số, chữ, space, toán tử, dấu chấm thập phân) */
  s = s.replace(/[^\p{L}\p{N}\s+\-*/^=().]/gu, ' ');

  /* 6. Bỏ stopwords (đầu/giữa/cuối) */
  const words = s.split(/\s+/).filter((w) => w.length > 0);
  const filtered = words.filter((w) => !STOPWORDS.has(w.toLowerCase()));
  s = filtered.join(' ');

  /* 7. Gộp space */
  s = s.replace(/\s+/g, ' ').trim();

  return s;
}

/* ═══════════════════════════════════════════════════════════════
   FUZZY MATCH — Levenshtein distance
   ═══════════════════════════════════════════════════════════════ */

/**
 * Levenshtein distance — số ký tự cần thêm/xóa/sửa để biến a → b.
 */
function levenshtein(a, b) {
  if (!a) return b ? b.length : 0;
  if (!b) return a.length;

  const m = a.length;
  const n = b.length;

  // Tối ưu — chỉ cần 2 hàng
  let prev = new Array(n + 1);
  let curr = new Array(n + 1);

  for (let j = 0; j <= n; j++) prev[j] = j;

  for (let i = 1; i <= m; i++) {
    curr[0] = i;
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(
        prev[j] + 1,        // xóa
        curr[j - 1] + 1,    // thêm
        prev[j - 1] + cost  // sửa
      );
    }
    [prev, curr] = [curr, prev];
  }

  return prev[n];
}

/**
 * Độ giống nhau giữa 2 chuỗi (0-1).
 */
function similarity(a, b) {
  if (!a || !b) return 0;
  const dist = levenshtein(a, b);
  const maxLen = Math.max(a.length, b.length);
  return maxLen === 0 ? 1 : 1 - dist / maxLen;
}

/**
 * So khớp mờ — không phân biệt dấu.
 * "nhan" vs "nhân" → 1.0 (vì bỏ dấu giống nhau)
 * "tinh" vs "tính" → 1.0
 */
function fuzzyEqual(a, b, threshold = 0.75) {
  if (!a || !b) return false;
  if (a === b) return true;

  // Bỏ dấu rồi so sánh trước
  const aNoDiacritic = removeDiacritics(a);
  const bNoDiacritic = removeDiacritics(b);
  if (aNoDiacritic === bNoDiacritic) return true;

  // Nếu không giống sau bỏ dấu → dùng Levenshtein
  const sim = similarity(aNoDiacritic, bNoDiacritic);
  return sim >= threshold;
}

/* ═══════════════════════════════════════════════════════════════
   PATTERN → REGEX
   ═══════════════════════════════════════════════════════════════ */

function patternToRegex(pattern) {
  let s = String(pattern);
  s = s.replace(/\s+/g, ' ').trim();

  // Đánh dấu placeholder
  s = s.replace(/\{a\}/g, '\u0001NUM\u0001');
  s = s.replace(/\{b\}/g, '\u0001NUM\u0001');
  s = s.replace(/\{c\}/g, '\u0001NUM\u0001');
  s = s.replace(/\{d\}/g, '\u0001NUM\u0001');
  s = s.replace(/\{n\}/g, '\u0001NUM\u0001');
  s = s.replace(/\{name\}/g, '\u0001STR\u0001');
  s = s.replace(/\{code\}/g, '\u0001CODE\u0001');
  s = s.replace(/\{error\}/g, '\u0001CODE\u0001');
  s = s.replace(/\{text\}/g, '\u0001CODE\u0001');

  // Escape ký tự đặc biệt
  s = s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  // Space → \s*
  s = s.replace(/ /g, '\\s*');

  // Khôi phục placeholder
  s = s.replace(/\u0001NUM\u0001/g, '(-?\\d+(?:[.,]\\d+)?)');
  s = s.replace(/\u0001STR\u0001/g, '([\\w\\u00C0-\\u1EF9]+)');
  s = s.replace(/\u0001CODE\u0001/g, '(.+?)');

  return new RegExp('^\\s*' + s + '\\s*$', 'iu');
}

/* ═══════════════════════════════════════════════════════════════
   MATCH PATTERN — regex exact + fuzzy fallback
   ═══════════════════════════════════════════════════════════════ */

/**
 * Thử regex exact.
 */
function tryRegexMatch(pattern, query) {
  try {
    const re = patternToRegex(pattern);
    const m = query.match(re);
    if (!m) return null;

    const placeholders = [];
    const re2 = /\{(\w+)\}/g;
    let match2;
    while ((match2 = re2.exec(pattern)) !== null) {
      placeholders.push(match2[1]);
    }

    const vars = {};
    placeholders.forEach((name, i) => {
      vars[name] = m[i + 1];
    });

    return vars;
  } catch (err) {
    logger.warn(`Pattern regex lỗi "${pattern}": ${err.message}`);
    return null;
  }
}

/**
 * Fuzzy match — so từng từ, không phân biệt dấu.
 * Dùng khi regex fail.
 */
function tryFuzzyMatch(pattern, query) {
  // Bỏ placeholder → pattern template
  const cleanPattern = pattern
    .replace(/\{a\}|\{b\}|\{c\}|\{d\}|\{n\}/g, 'NUM')
    .replace(/\{name\}/g, 'STR')
    .replace(/\{code\}|\{error\}|\{text\}/g, 'CODE')
    .replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    .toLowerCase()
    .trim();

  const cleanQuery = query.toLowerCase().trim();

  // Đơn giản: so similarity toàn câu với toàn pattern (thay NUM/STR/CODE bằng dấu *)
  // Không match vars — chỉ trả về "matched" để caller biết
  const patternTemplate = cleanPattern
    .replace(/NUM/g, '')
    .replace(/STR/g, '')
    .replace(/CODE/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  const queryClean = cleanQuery.replace(/\s+/g, ' ').trim();

  // So từng từ
  const patternWords = patternTemplate.split(/\s+/).filter((w) => w);
  const queryWords = queryClean.split(/\s+/).filter((w) => w);

  if (patternWords.length === 0) return null;

  // Đếm số từ khớp fuzzy
  let matched = 0;
  for (const pw of patternWords) {
    for (const qw of queryWords) {
      if (fuzzyEqual(pw, qw, 0.75)) {
        matched++;
        break;
      }
    }
  }

  const ratio = matched / patternWords.length;
  if (ratio >= 0.75) {
    return { _fuzzy: true, _ratio: ratio };
  }

  return null;
}

/**
 * Match câu hỏi với patterns → vars
 * 1. Regex exact
 * 2. Fuzzy match (nếu regex fail)
 */
function matchPattern(patterns, query) {
  if (!Array.isArray(patterns) || patterns.length === 0) return null;
  if (!query || typeof query !== 'string') return null;

  const q = normalizeQuery(query);
  logger.debug(`normalizeQuery: "${query}" → "${q}"`);

  if (!q) return null;

  /* ═══ TẦNG 1 — Regex exact ═══ */
  for (const p of patterns) {
    const vars = tryRegexMatch(p, q);
    if (vars) {
      logger.debug(`✅ Regex match: "${p}" → vars=${JSON.stringify(vars)}`);
      return vars;
    }
  }

  /* ═══ TẦNG 2 — Fuzzy match ═══ */
  for (const p of patterns) {
    const fuzzy = tryFuzzyMatch(p, q);
    if (fuzzy) {
      logger.debug(`🔍 Fuzzy match: "${p}" (ratio=${fuzzy._ratio.toFixed(2)})`);
      // Fuzzy match chỉ trả về dấu hiệu match — không extract vars được
      // Vars sẽ được extract bằng regex lỏng hơn trong matchPattern
      return { _fuzzy: true, _pattern: p, _ratio: fuzzy._ratio };
    }
  }

  return null;
}

/* ═══════════════════════════════════════════════════════════════
   CHUẨN HÓA SỐ + DETECT LANG
   ═══════════════════════════════════════════════════════════════ */

function parseNum(v) {
  if (typeof v === 'number') return v;
  const s = String(v).replace(',', '.');
  const n = Number(s);
  return Number.isNaN(n) ? v : n;
}

function detectLangFromCode(code) {
  if (!code) return 'python';
  if (/^\s*def\s+\w+\s*\(|print\s*\(/m.test(code)) return 'python';
  if (/^\s*function\s+\w+\s*\(|console\.log/m.test(code)) return 'javascript';
  if (/^\s*public\s+class|System\.out\.println/m.test(code)) return 'java';
  if (/^\s*#include|int\s+main\s*\(/m.test(code)) return 'cpp';
  if (/^\s*package\s+main|fmt\.Print/m.test(code)) return 'go';
  if (/^\s*fn\s+main|println!/m.test(code)) return 'rust';
  return 'python';
}

/* ═══════════════════════════════════════════════════════════════
   RUN LOGIC — async
   ═══════════════════════════════════════════════════════════════ */

async function runLogic({ logicType, logicValue, vars }) {
  if (!logicType) return { success: false, error: 'Thiếu logicType' };

  /* ═══ NHÁNH A — expr ═══ */
  if (logicType === 'expr') {
    if (!logicValue) return { success: false, error: 'Thiếu logicValue' };

    try {
      const scope = {};
      for (const [k, v] of Object.entries(vars || {})) {
        scope[k] = parseNum(v);
      }

      const kq = evaluate(logicValue, scope);
      return { success: true, kq };
    } catch (err) {
      logger.warn(`Logic expr lỗi: ${err.message}`);
      return { success: false, error: err.message };
    }
  }

  /* ═══ NHÁNH B — code ═══ */
  if (logicType === 'code') {
    if (!logicValue) return { success: false, error: 'Thiếu logicValue' };

    let code = logicValue;
    for (const [k, v] of Object.entries(vars || {})) {
      code = code.replace(new RegExp(`\\{${k}\\}`, 'g'), v);
    }

    const language = detectLangFromCode(code);
    logger.info(`🧪 Nhánh code — chạy qua Judge0 (${language})`);

    const result = await testCode({ code, language });

    if (result.success) {
      return { success: true, kq: code, output: result.stdout, language, isCode: true };
    }

    logger.warn(`Judge0 chạy code lỗi: ${result.error}`);
    return { success: false, kq: code, output: result.stdout, language, isCode: true, error: result.error };
  }

  /* ═══ NHÁNH C — patch ═══ */
  if (logicType === 'patch') {
    if (!logicValue) return { success: false, error: 'Thiếu logicValue' };

    let patch = logicValue;
    for (const [k, v] of Object.entries(vars || {})) {
      patch = patch.replace(new RegExp(`\\{${k}\\}`, 'g'), v);
    }

    const language = detectLangFromCode(patch);
    logger.info(`🧪 Nhánh patch — chạy qua Judge0 (${language})`);

    const result = await testCode({ code: patch, language });

    if (result.success) {
      return { success: true, kq: patch, output: result.stdout, language, isPatch: true };
    }

    logger.warn(`Judge0 chạy patch lỗi: ${result.error}`);
    return { success: false, kq: patch, output: result.stdout, language, isPatch: true, error: result.error };
  }

  return { success: false, error: `logicType không hỗ trợ: ${logicType}` };
}

/* ═══════════════════════════════════════════════════════════════
   FORMAT OUTPUT
   ═══════════════════════════════════════════════════════════════ */

function formatOutput(tpl, vars, kq) {
  if (!tpl) return String(kq);

  let out = String(tpl);

  for (const [k, v] of Object.entries(vars || {})) {
    out = out.replace(new RegExp(`\\{${k}\\}`, 'g'), v);
  }

  let kqStr;
  if (typeof kq === 'number' && Number.isFinite(kq)) {
    if (Number.isInteger(kq)) {
      kqStr = String(kq);
    } else {
      kqStr = String(kq).replace('.', ',');
    }
  } else {
    kqStr = String(kq);
  }

  out = out.replace(/\{kq\}/g, kqStr);

  return out;
}

/* ═══════════════════════════════════════════════════════════════
   EXPORTS
   ═══════════════════════════════════════════════════════════════ */

module.exports = {
  patternToRegex,
  matchPattern,
  runLogic,
  formatOutput,
  normalizeQuery,
  detectLangFromCode,
  parseNum,
  // [MỚI] export thêm
  levenshtein,
  similarity,
  fuzzyEqual,
  removeDiacritics,
  fixSpelling,
  STOPWORDS,
  SPELL_FIX,
};