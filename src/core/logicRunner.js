/* ═══════════════════════════════════════════════════════════════
   🎯 LOGIC RUNNER — Match pattern LINH HOẠT + chạy logic (async)
   - Normalize mạnh: viết thường, bỏ dấu câu, dedupe
   - Bỏ stopwords toàn diện (đầu/giữa/cuối)
   - Bảng sửa chính tả phổ biến
   - Fuzzy match (Levenshtein) — chạy JS thuần
   - Nhánh expr: mathjs | Nhánh code/patch: Judge0
   ═══════════════════════════════════════════════════════════════ */

const { evaluate } = require('mathjs');
const { testCode } = require('./judge0Test');       /* ← ĐÃ ĐỔI TỪ ./pistonTest */
const logger = require('../utils/logger');

/* ═══════════════════════════════════════════════════════════════
   STOPWORDS — bỏ khi match (mọi vị trí)
   ═══════════════════════════════════════════════════════════════ */

const STOPWORDS = new Set([
  'tính', 'giúp', 'giùm', 'hộ', 'dùm', 'cho', 'hỏi', 'xem', 'thử',
  'làm', 'ơn', 'với', 'và', 'của', 'thì', 'mà', 'để', 'được',
  'là', 'bao', 'nhiêu', 'mấy', 'bằng', 'kết', 'quả', 'cho', 'biết',
  'vậy', 'ạ', 'à', 'nhé', 'nha', 'nào', 'gì', 'sao', 'đâu', 'khi',
  'tôi', 'mình', 'em', 'anh', 'chị', 'bạn', 'ta', 'tớ',
  'please', 'help', 'calculate', 'compute', 'what', 'is', 'the',
  '?', '!', '.', ',', ';', ':',
]);

/* ═══════════════════════════════════════════════════════════════
   BẢNG SỬA CHÍNH TẢ — hardcode, không gọi model
   ═══════════════════════════════════════════════════════════════ */

const SPELL_FIX = {
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
  'tinh': 'tính',
  'giup': 'giúp',
  'gium': 'giùm',
  'ho': 'hộ',
  'dum': 'dùm',
  'bao nhieu': 'bao nhiêu',
  'bang may': 'bằng mấy',
  'ket qua': 'kết quả',
  'viet': 'viết',
  'tao': 'tạo',
  'ham': 'hàm',
  'code': 'code',
  'lap trinh': 'lập trình',
  'chuong trinh': 'chương trình',
  'sua': 'sửa',
  'loi': 'lỗi',
  'debug': 'debug',
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

function removeDiacritics(str) {
  if (!str) return '';
  return String(str)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D');
}

function fixSpelling(text) {
  if (!text) return '';
  let s = String(text).toLowerCase();

  const keys = Object.keys(SPELL_FIX).sort((a, b) => b.length - a.length);

  for (const wrong of keys) {
    const correct = SPELL_FIX[wrong];
    const re = new RegExp(`(^|\\s)${wrong.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(\\s|$)`, 'giu');
    s = s.replace(re, `$1${correct}$2`);
  }

  return s;
}

function normalizeQuery(query) {
  if (!query || typeof query !== 'string') return '';

  let s = query.trim();
  s = s.toLowerCase();
  s = fixSpelling(s);
  s = s.replace(/(\d)\s*([+\-*/^=])\s*(\d)/g, '$1 $2 $3');
  s = s.replace(/(\d),(\d)/g, '$1.$2');
  s = s.replace(/[^\p{L}\p{N}\s+\-*/^=().]/gu, ' ');

  const words = s.split(/\s+/).filter((w) => w.length > 0);
  const filtered = words.filter((w) => !STOPWORDS.has(w.toLowerCase()));
  s = filtered.join(' ');

  s = s.replace(/\s+/g, ' ').trim();
  return s;
}

/* ═══════════════════════════════════════════════════════════════
   FUZZY MATCH — Levenshtein distance
   ═══════════════════════════════════════════════════════════════ */

function levenshtein(a, b) {
  if (!a) return b ? b.length : 0;
  if (!b) return a.length;

  const m = a.length;
  const n = b.length;

  let prev = new Array(n + 1);
  let curr = new Array(n + 1);

  for (let j = 0; j <= n; j++) prev[j] = j;

  for (let i = 1; i <= m; i++) {
    curr[0] = i;
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + cost);
    }
    [prev, curr] = [curr, prev];
  }

  return prev[n];
}

function similarity(a, b) {
  if (!a || !b) return 0;
  const dist = levenshtein(a, b);
  const maxLen = Math.max(a.length, b.length);
  return maxLen === 0 ? 1 : 1 - dist / maxLen;
}

function fuzzyEqual(a, b, threshold = 0.75) {
  if (!a || !b) return false;
  if (a === b) return true;

  const aNoDiacritic = removeDiacritics(a);
  const bNoDiacritic = removeDiacritics(b);
  if (aNoDiacritic === bNoDiacritic) return true;

  const sim = similarity(aNoDiacritic, bNoDiacritic);
  return sim >= threshold;
}

/* ═══════════════════════════════════════════════════════════════
   PATTERN → REGEX
   ═══════════════════════════════════════════════════════════════ */

function patternToRegex(pattern) {
  let s = String(pattern);
  s = s.replace(/\s+/g, ' ').trim();

  s = s.replace(/\{a\}/g, '\u0001NUM\u0001');
  s = s.replace(/\{b\}/g, '\u0001NUM\u0001');
  s = s.replace(/\{c\}/g, '\u0001NUM\u0001');
  s = s.replace(/\{d\}/g, '\u0001NUM\u0001');
  s = s.replace(/\{n\}/g, '\u0001NUM\u0001');
  s = s.replace(/\{name\}/g, '\u0001STR\u0001');
  s = s.replace(/\{code\}/g, '\u0001CODE\u0001');
  s = s.replace(/\{error\}/g, '\u0001CODE\u0001');
  s = s.replace(/\{text\}/g, '\u0001CODE\u0001');

  s = s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  s = s.replace(/ /g, '\\s*');

  s = s.replace(/\u0001NUM\u0001/g, '(-?\\d+(?:[.,]\\d+)?)');
  s = s.replace(/\u0001STR\u0001/g, '([\\w\\u00C0-\\u1EF9]+)');
  s = s.replace(/\u0001CODE\u0001/g, '(.+?)');

  return new RegExp('^\\s*' + s + '\\s*$', 'iu');
}

/* ═══════════════════════════════════════════════════════════════
   MATCH PATTERN — regex exact + fuzzy fallback
   ═══════════════════════════════════════════════════════════════ */

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

function tryFuzzyMatch(pattern, query) {
  const cleanPattern = pattern
    .replace(/\{a\}|\{b\}|\{c\}|\{d\}|\{n\}/g, 'NUM')
    .replace(/\{name\}/g, 'STR')
    .replace(/\{code\}|\{error\}|\{text\}/g, 'CODE')
    .replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    .toLowerCase()
    .trim();

  const cleanQuery = query.toLowerCase().trim();

  const patternTemplate = cleanPattern
    .replace(/NUM/g, '')
    .replace(/STR/g, '')
    .replace(/CODE/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  const queryClean = cleanQuery.replace(/\s+/g, ' ').trim();

  const patternWords = patternTemplate.split(/\s+/).filter((w) => w);
  const queryWords = queryClean.split(/\s+/).filter((w) => w);

  if (patternWords.length === 0) return null;

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

function matchPattern(patterns, query) {
  if (!Array.isArray(patterns) || patterns.length === 0) return null;
  if (!query || typeof query !== 'string') return null;

  const q = normalizeQuery(query);
  logger.debug(`normalizeQuery: "${query}" → "${q}"`);

  if (!q) return null;

  for (const p of patterns) {
    const vars = tryRegexMatch(p, q);
    if (vars) {
      logger.debug(`✅ Regex match: "${p}" → vars=${JSON.stringify(vars)}`);
      return vars;
    }
  }

  for (const p of patterns) {
    const fuzzy = tryFuzzyMatch(p, q);
    if (fuzzy) {
      logger.debug(`🔍 Fuzzy match: "${p}" (ratio=${fuzzy._ratio.toFixed(2)})`);
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

module.exports = {
  patternToRegex,
  matchPattern,
  runLogic,
  formatOutput,
  normalizeQuery,
  detectLangFromCode,
  parseNum,
  levenshtein,
  similarity,
  fuzzyEqual,
  removeDiacritics,
  fixSpelling,
  STOPWORDS,
  SPELL_FIX,
};