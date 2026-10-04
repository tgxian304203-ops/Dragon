/* ═══════════════════════════════════════════════════════════════
   🎯 LOGIC RUNNER — Match pattern + chạy logic + cây quyết định
   - Normalize mạnh, fuzzy match
   - Nhánh expr: mathjs | Nhánh code/patch: Judge0
   - HTML/CSS: KHÔNG chạy Judge0
   - chayCayQuyetDinh — Tiểu não tư duy từ cây JSON
   - [SỬA] evalCondition không thay biến vào giữa từ khác (Unicode safe)
   - [SỬA] mathjs xử lý biến undefined (sum động)
   ═══════════════════════════════════════════════════════════════ */

const { evaluate } = require('mathjs');
const { testCode } = require('./judge0Test');
const logger = require('../utils/logger');

/* ═══════════════════════════════════════════════════════════════
   STOPWORDS + SPELL FIX
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

const SPELL_FIX = {
  'nhan': 'nhân', 'nhân': 'nhân', 'cong': 'cộng', 'công': 'cộng',
  'tru': 'trừ', 'trừ': 'trừ', 'chia': 'chia', 'chi': 'chia',
  'mu': 'mũ', 'luy thua': 'lũy thừa', 'tong': 'tổng', 'hieu': 'hiệu',
  'tich': 'tích', 'thuong': 'thương', 'tinh': 'tính', 'giup': 'giúp',
  'gium': 'giùm', 'ho': 'hộ', 'dum': 'dùm', 'bao nhieu': 'bao nhiêu',
  'viet': 'viết', 'tao': 'tạo', 'ham': 'hàm', 'lap trinh': 'lập trình',
  'sua': 'sửa', 'loi': 'lỗi', 'khong': 'không', 'mot': 'một',
  'hai': 'hai', 'ba': 'ba', 'bon': 'bốn', 'nam': 'năm',
  'sau': 'sáu', 'bay': 'bảy', 'tam': 'tám', 'chin': 'chín',
  'muoi': 'mười', 'phay': 'phẩy', 'cham': 'chấm',
};

function removeDiacritics(str) {
  if (!str) return '';
  return String(str).normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd').replace(/Đ/g, 'D');
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
  let s = query.trim().toLowerCase();
  s = fixSpelling(s);
  s = s.replace(/(\d)\s*([+\-*/^=])\s*(\d)/g, '$1 $2 $3');
  s = s.replace(/(\d),(\d)/g, '$1.$2');
  s = s.replace(/[^\p{L}\p{N}\s+\-*/^=().]/gu, ' ');
  const words = s.split(/\s+/).filter((w) => w.length > 0);
  const filtered = words.filter((w) => !STOPWORDS.has(w.toLowerCase()));
  s = filtered.join(' ');
  return s.replace(/\s+/g, ' ').trim();
}

/* ═══════════════════════════════════════════════════════════════
   FUZZY MATCH
   ═══════════════════════════════════════════════════════════════ */

function levenshtein(a, b) {
  if (!a) return b ? b.length : 0;
  if (!b) return a.length;
  const m = a.length; const n = b.length;
  let prev = new Array(n + 1); let curr = new Array(n + 1);
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
  return similarity(aNoDiacritic, bNoDiacritic) >= threshold;
}

/* ═══════════════════════════════════════════════════════════════
   PATTERN → REGEX + MATCH
   ═══════════════════════════════════════════════════════════════ */

function patternToRegex(pattern) {
  let s = String(pattern).replace(/\s+/g, ' ').trim();
  s = s.replace(/\{a\}/g, '\u0001NUM\u0001').replace(/\{b\}/g, '\u0001NUM\u0001')
    .replace(/\{c\}/g, '\u0001NUM\u0001').replace(/\{d\}/g, '\u0001NUM\u0001')
    .replace(/\{e\}/g, '\u0001NUM\u0001')
    .replace(/\{n\}/g, '\u0001NUM\u0001')
    .replace(/\{name\}/g, '\u0001STR\u0001')
    .replace(/\{code\}/g, '\u0001CODE\u0001').replace(/\{error\}/g, '\u0001CODE\u0001')
    .replace(/\{text\}/g, '\u0001CODE\u0001');
  s = s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/ /g, '\\s*');
  s = s.replace(/\u0001NUM\u0001/g, '(-?\\d+(?:[.,]\\d+)?)');
  s = s.replace(/\u0001STR\u0001/g, '([\\w\\u00C0-\\u1EF9]+)');
  s = s.replace(/\u0001CODE\u0001/g, '(.+?)');
  return new RegExp('^\\s*' + s + '\\s*$', 'iu');
}

function tryRegexMatch(pattern, query) {
  try {
    const re = patternToRegex(pattern);
    const m = query.match(re);
    if (!m) return null;
    const placeholders = [];
    const re2 = /\{(\w+)\}/g;
    let match2;
    while ((match2 = re2.exec(pattern)) !== null) placeholders.push(match2[1]);
    const vars = {};
    placeholders.forEach((name, i) => { vars[name] = m[i + 1]; });
    return vars;
  } catch (err) {
    logger.warn(`Pattern regex lỗi "${pattern}": ${err.message}`);
    return null;
  }
}

function tryFuzzyMatch(pattern, query) {
  const cleanPattern = pattern
    .replace(/\{a\}|\{b\}|\{c\}|\{d\}|\{e\}|\{n\}/g, 'NUM')
    .replace(/\{name\}/g, 'STR')
    .replace(/\{code\}|\{error\}|\{text\}/g, 'CODE')
    .replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    .toLowerCase().trim();
  const cleanQuery = query.toLowerCase().trim();
  const patternTemplate = cleanPattern.replace(/NUM/g, '').replace(/STR/g, '').replace(/CODE/g, '').replace(/\s+/g, ' ').trim();
  const queryClean = cleanQuery.replace(/\s+/g, ' ').trim();
  const patternWords = patternTemplate.split(/\s+/).filter((w) => w);
  const queryWords = queryClean.split(/\s+/).filter((w) => w);
  if (patternWords.length === 0) return null;
  let matched = 0;
  for (const pw of patternWords) {
    for (const qw of queryWords) {
      if (fuzzyEqual(pw, qw, 0.75)) { matched++; break; }
    }
  }
  const ratio = matched / patternWords.length;
  if (ratio >= 0.75) return { _fuzzy: true, _ratio: ratio };
  return null;
}

function matchPattern(patterns, query) {
  if (!Array.isArray(patterns) || patterns.length === 0) return null;
  if (!query || typeof query !== 'string') return null;
  const q = normalizeQuery(query);
  if (!q) return null;
  for (const p of patterns) {
    const vars = tryRegexMatch(p, q);
    if (vars) return vars;
  }
  for (const p of patterns) {
    const fuzzy = tryFuzzyMatch(p, q);
    if (fuzzy) return { _fuzzy: true, _pattern: p, _ratio: fuzzy._ratio };
  }
  return null;
}

/* ═══════════════════════════════════════════════════════════════
   PARSE NUM + DETECT LANG
   ═══════════════════════════════════════════════════════════════ */

function parseNum(v) {
  if (typeof v === 'number') return v;
  const s = String(v).replace(',', '.');
  const n = Number(s);
  return Number.isNaN(n) ? v : n;
}

function detectLangFromCode(code) {
  if (!code) return 'python';
  const c = String(code);
  if (/<!DOCTYPE\s+html/i.test(c)) return 'html';
  if (/<html[\s>]/i.test(c)) return 'html';
  if (/<body[\s>]/i.test(c)) return 'html';
  if (/<div[\s>]|<span[\s>]|<p[\s>]|<h[1-6][\s>]/i.test(c)) return 'html';
  if (/^\s*[.#]?[\w-]+\s*\{[^}]*:\s*[^;]+;/m.test(c) && !/\bfunction\b|\bdef\b|\bconst\b|\blet\b/m.test(c)) return 'css';
  if (/^\s*def\s+\w+\s*\(|print\s*\(/m.test(c)) return 'python';
  if (/^\s*function\s+\w+\s*\(|console\.log/m.test(c)) return 'javascript';
  if (/^\s*public\s+class|System\.out\.println/m.test(c)) return 'java';
  if (/^\s*#include|int\s+main\s*\(/m.test(c)) return 'cpp';
  if (/^\s*package\s+main|fmt\.Print/m.test(c)) return 'go';
  if (/^\s*fn\s+main|println!/m.test(c)) return 'rust';
  return 'python';
}

function isRunnableLang(lang) {
  const l = String(lang || '').toLowerCase();
  return ['python', 'javascript', 'java', 'cpp', 'go', 'rust', 'c', 'typescript', 'php', 'ruby'].includes(l);
}

/* ═══════════════════════════════════════════════════════════════
   EXTRACT BIẾN TỪ CÂU HỎI THEO CATEGORY
   ═══════════════════════════════════════════════════════════════ */

function extractNumbers(problem) {
  const s = String(problem).replace(/(\d),(\d)/g, '$1.$2');
  const re = /-?\d+(?:\.\d+)?/g;
  const matches = s.match(re) || [];
  return matches.map((m) => Number(m)).filter((n) => !Number.isNaN(n));
}

function extractVarsMath(problem) {
  const nums = extractNumbers(problem);
  const vars = {
    soLuongSo: nums.length,
    coSoAm: nums.some((n) => n < 0),
    coSoThapPhan: nums.some((n) => !Number.isInteger(n)),
    coSo0: nums.some((n) => n === 0),
    tuKhoa: '',
  };

  const letters = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
  nums.slice(0, 8).forEach((n, i) => { vars[letters[i]] = n; });

  const q = String(problem).toLowerCase();
  if (/tổng|sum|tong/.test(q)) vars.tuKhoa = 'tổng';
  else if (/cộng|\+|cong|add|plus/.test(q)) vars.tuKhoa = 'cộng';
  else if (/trừ|hiệu|\-|tru|minus|subtract/.test(q)) vars.tuKhoa = 'trừ';
  else if (/nhân|tích|\*|×|nhan|multiply/.test(q)) vars.tuKhoa = 'nhân';
  else if (/chia|thương|\/|divide/.test(q)) vars.tuKhoa = 'chia';

  return vars;
}

function extractVarsCode(problem) {
  const q = String(problem).toLowerCase();
  const vars = { ngonNgu: '', loai: '', tenHam: '', thamSo: '', mucDich: '' };

  if (/python|py\b/.test(q)) vars.ngonNgu = 'python';
  else if (/javascript|js\b|node/.test(q)) vars.ngonNgu = 'javascript';
  else if (/html|web|shop|trang/.test(q)) vars.ngonNgu = 'html';
  else if (/java\b/.test(q)) vars.ngonNgu = 'java';
  else if (/c\+\+/.test(q)) vars.ngonNgu = 'cpp';
  else if (/go\b|golang/.test(q)) vars.ngonNgu = 'go';
  else if (/rust/.test(q)) vars.ngonNgu = 'rust';

  if (/hàm|function/.test(q)) vars.loai = 'hàm';
  else if (/class|lớp/.test(q)) vars.loai = 'class';
  else if (/script/.test(q)) vars.loai = 'script';
  else if (/web|shop|trang/.test(q)) vars.loai = 'web';
  else if (/ui|giao diện/.test(q)) vars.loai = 'UI';

  return vars;
}

function extractVarsBugfix(problem) {
  const q = String(problem).toLowerCase();
  const vars = { loaiLoi: '', ngonNgu: '', dongLoi: 0, noiDungLoi: '' };

  if (/undefined|không xác định|chưa khai báo/.test(q)) vars.loaiLoi = 'undefined';
  else if (/syntax|cú pháp/.test(q)) vars.loaiLoi = 'syntax';
  else if (/logic|sai logic/.test(q)) vars.loaiLoi = 'logic';
  else if (/runtime|thời gian chạy/.test(q)) vars.loaiLoi = 'runtime';

  if (/python|py\b/.test(q)) vars.ngonNgu = 'python';
  else if (/javascript|js\b/.test(q)) vars.ngonNgu = 'javascript';
  else if (/html/.test(q)) vars.ngonNgu = 'html';

  const m = q.match(/dòng\s*(\d+)/);
  if (m) vars.dongLoi = Number(m[1]);

  vars.noiDungLoi = problem.slice(0, 200);
  return vars;
}

function extractVarsExplain(problem) {
  const q = String(problem).toLowerCase();
  const vars = { loaiVan: '', doDai: '', chuDe: '', giongVan: '' };

  if (/kể chuyện|kể lại/.test(q)) vars.loaiVan = 'kể';
  else if (/miêu tả|tả/.test(q)) vars.loaiVan = 'miêu tả';
  else if (/phân tích/.test(q)) vars.loaiVan = 'phân tích';
  else if (/nghị luận|chứng minh/.test(q)) vars.loaiVan = 'nghị luận';

  if (/ngắn/.test(q)) vars.doDai = 'ngắn';
  else if (/dài/.test(q)) vars.doDai = 'dài';
  else vars.doDai = 'vừa';

  if (/trang trọng/.test(q)) vars.giongVan = 'trang trọng';
  else vars.giongVan = 'thân mật';

  vars.chuDe = problem.slice(0, 100);
  return vars;
}

function extractVarsTheoCategory(problem, category) {
  switch (category) {
    case 'math': return extractVarsMath(problem);
    case 'code': return extractVarsCode(problem);
    case 'bugfix': return extractVarsBugfix(problem);
    case 'explain': return extractVarsExplain(problem);
    default: return {};
  }
}

/* ═══════════════════════════════════════════════════════════════
   [SỬA] EVAL ĐIỀU KIỆN — KHÔNG THAY BIẾN VÀO GIỮA TỪ KHÁC
   ═══════════════════════════════════════════════════════════════ */

function evalCondition(condition, vars) {
  if (typeof condition !== 'string' || condition.trim() === '') return false;

  // Blacklist từ khóa nguy hiểm
  const dangerous = /\b(require|import|eval|Function|process|global|window|document|fs|child_process|__proto__|constructor|prototype)\b/i;
  if (dangerous.test(condition)) {
    logger.warn(`evalCondition: từ khóa nguy hiểm — "${condition}"`);
    return false;
  }

  // [SỬA] Thay biến — CHỈ KHI ĐỨNG RIÊNG (Unicode safe)
  let expr = condition;
  const keys = Object.keys(vars).sort((a, b) => b.length - a.length);

  for (const k of keys) {
    const val = vars[k];
    let valStr;
    if (typeof val === 'string') valStr = JSON.stringify(val);
    else if (typeof val === 'boolean') valStr = String(val);
    else if (typeof val === 'number') valStr = String(val);
    else valStr = 'null';

    // [SỬA] Chỉ thay khi biến đứng riêng — không match trong từ khác
    // VD: không thay "c" trong "cộng" thành "3"
    const escapedK = k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const re = new RegExp(`(^|[^\\p{L}\\p{N}_])${escapedK}(?![\\p{L}\\p{N}_])`, 'gu');
    expr = expr.replace(re, `$1${valStr}`);
  }

  // Whitelist ký tự an toàn
  const safeChars = /^[\s\d+\-*/%().<>=!&|'"a-zA-Z_,;]+$/;
  if (!safeChars.test(expr)) {
    logger.debug(`evalCondition: ký tự không an toàn — "${expr}"`);
    return false;
  }

  // Blacklist sau thay biến
  if (/\b(eval|Function|require|import|process|global|window|document|fs|child_process|__proto__|constructor|prototype)\b/i.test(expr)) {
    logger.warn(`evalCondition: sau thay biến có từ nguy hiểm — "${expr}"`);
    return false;
  }

  try {
    // eslint-disable-next-line no-new-func
    const result = Function(`"use strict"; return (${expr});`)();
    return result === true;
  } catch (err) {
    logger.debug(`evalCondition lỗi "${condition}" → "${expr}": ${err.message}`);
    return false;
  }
}

/* ═══════════════════════════════════════════════════════════════
   MATHJS — Xử lý biến undefined (sum động)
   ═══════════════════════════════════════════════════════════════ */

function fixDynamicSum(logicValue, scope) {
  return String(logicValue).replace(/sum\s*\(\s*\[([^\]]+)\]\s*\)/gi, (match, inner) => {
    const names = inner.split(',').map((s) => s.trim()).filter(Boolean);
    const validNames = names.filter((n) => typeof scope[n] === 'number' && Number.isFinite(scope[n]));
    if (validNames.length === 0) return '0';
    return `sum([${validNames.map((n) => scope[n]).join(',')}])`;
  });
}

function safeEvalMathjs(logicValue, scope) {
  let expr = fixDynamicSum(logicValue, scope);
  const singleLetters = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
  for (const letter of singleLetters) {
    if (typeof scope[letter] !== 'number') {
      const re = new RegExp(`\\b${letter}\\b`, 'g');
      expr = expr.replace(re, '0');
    }
  }
  return expr;
}

/* ═══════════════════════════════════════════════════════════════
   CHẠY CÂY QUYẾT ĐỊNH — Tiểu não tư duy
   ═══════════════════════════════════════════════════════════════ */

async function chayCayQuyetDinh({ tip, problem }) {
  if (!tip || !tip.cayQuyetDinhJson) {
    return { success: false, error: 'TIP không có cây quyết định' };
  }

  const cay = tip.cayQuyetDinhJson;
  const category = cay.category || tip.category || 'general';
  const vars = extractVarsTheoCategory(problem, category);

  logger.debug(`🌳 Cây quyết định [${category}] — vars: ${JSON.stringify(vars).slice(0, 200)}`);

  if (!Array.isArray(cay.rules) || cay.rules.length === 0) {
    return { success: false, error: 'Cây không có rules' };
  }

  for (const rule of cay.rules) {
    try {
      const matched = evalCondition(rule.if, vars);
      if (!matched) continue;

      logger.info(`🎯 Cây match rule: "${rule.if}"`);

      const then = rule.then || {};
      const logicType = String(then.logicType || '').toLowerCase();
      const logicValue = then.logicValue || '';
      const outputTpl = then.outputTpl || '';

      const result = await chayLogicVoiVars({
        logicType, logicValue, outputTpl, vars, problem,
      });

      if (result.success) return { ...result, vars };
      logger.warn(`Rule match nhưng chạy logic lỗi: ${result.error}`);
    } catch (err) {
      logger.warn(`Rule lỗi "${rule.if}": ${err.message}`);
    }
  }

  logger.debug(`Không rule nào match — thử fallback cây`);
  return { success: false, error: 'Không rule nào match', vars };
}

async function chayLogicVoiVars({ logicType, logicValue, outputTpl, vars, problem }) {
  if (!logicType) {
    if (outputTpl) {
      const formatted = formatOutputTpl(outputTpl, vars, '');
      return { success: true, kq: formatted, output: '', isText: true, formatted };
    }
    return { success: false, error: 'Không có logicType và outputTpl' };
  }

  if (logicType === 'expr') {
    if (!logicValue) return { success: false, error: 'Thiếu logicValue' };
    try {
      const scope = {};
      for (const [k, v] of Object.entries(vars)) {
        if (typeof v === 'number') scope[k] = v;
      }

      const exprSafe = safeEvalMathjs(logicValue, scope);
      const scopeSafe = {};
      for (const [k, v] of Object.entries(scope)) {
        if (Number.isFinite(v)) scopeSafe[k] = v;
      }

      const kq = evaluate(exprSafe, scopeSafe);
      const formatted = formatOutputTpl(outputTpl || '{kq}', vars, kq);
      return { success: true, kq: formatted, output: '', kqRaw: kq, isExpr: true, formatted };
    } catch (err) {
      return { success: false, error: `mathjs: ${err.message}` };
    }
  }

  if (logicType === 'code' || logicType === 'patch') {
    if (!logicValue) return { success: false, error: 'Thiếu logicValue' };

    let code = logicValue;
    for (const [k, v] of Object.entries(vars)) {
      code = code.replace(new RegExp(`\\{${k}\\}`, 'g'), String(v));
    }

    const language = detectLangFromCode(code);

    if (!isRunnableLang(language)) {
      return {
        success: true, kq: code, output: '', language,
        isCode: logicType === 'code', isPatch: logicType === 'patch',
        skippedRun: true, formatted: formatOutputTpl(outputTpl || '{kq}', vars, code),
      };
    }

    const result = await testCode({ code, language });
    if (result.success) {
      return {
        success: true, kq: code, output: result.stdout || '', language,
        isCode: logicType === 'code', isPatch: logicType === 'patch',
        formatted: formatOutputTpl(outputTpl || '{kq}', vars, code),
      };
    }
    return {
      success: false, kq: code, output: result.stdout || '', language,
      error: result.error,
      isCode: logicType === 'code', isPatch: logicType === 'patch',
    };
  }

  return { success: false, error: `logicType không hỗ trợ: ${logicType}` };
}

function formatOutputTpl(tpl, vars, kq) {
  let out = String(tpl);
  for (const [k, v] of Object.entries(vars || {})) {
    out = out.replace(new RegExp(`\\{${k}\\}`, 'g'), String(v));
  }
  let kqStr;
  if (typeof kq === 'number' && Number.isFinite(kq)) {
    kqStr = Number.isInteger(kq) ? String(kq) : String(kq).replace('.', ',');
  } else {
    kqStr = String(kq);
  }
  out = out.replace(/\{kq\}/g, kqStr);
  return out;
}

/* ═══════════════════════════════════════════════════════════════
   RUN LOGIC — Nhánh A/B/C cũ
   ═══════════════════════════════════════════════════════════════ */

async function runLogic({ logicType, logicValue, vars }) {
  if (!logicType) return { success: false, error: 'Thiếu logicType' };

  if (logicType === 'expr') {
    if (!logicValue) return { success: false, error: 'Thiếu logicValue' };
    try {
      const scope = {};
      for (const [k, v] of Object.entries(vars || {})) scope[k] = parseNum(v);

      const exprSafe = safeEvalMathjs(logicValue, scope);
      const scopeSafe = {};
      for (const [k, v] of Object.entries(scope)) {
        if (Number.isFinite(v)) scopeSafe[k] = v;
      }

      const kq = evaluate(exprSafe, scopeSafe);
      return { success: true, kq };
    } catch (err) {
      logger.warn(`Logic expr lỗi: ${err.message}`);
      return { success: false, error: err.message };
    }
  }

  if (logicType === 'code' || logicType === 'patch') {
    if (!logicValue) return { success: false, error: 'Thiếu logicValue' };
    let code = logicValue;
    for (const [k, v] of Object.entries(vars || {})) {
      code = code.replace(new RegExp(`\\{${k}\\}`, 'g'), v);
    }
    const language = detectLangFromCode(code);
    const isPatch = logicType === 'patch';

    if (!isRunnableLang(language)) {
      logger.info(`📄 Code ${language} — chỉ hiển thị, không chạy Judge0`);
      return { success: true, kq: code, output: '', language, isCode: !isPatch, isPatch, skippedRun: true };
    }

    logger.info(`🧪 Nhánh ${logicType} — chạy qua Judge0 (${language})`);
    const result = await testCode({ code, language });
    if (result.success) {
      return { success: true, kq: code, output: result.stdout, language, isCode: !isPatch, isPatch };
    }
    logger.warn(`Judge0 chạy code lỗi: ${result.error}`);
    return { success: false, kq: code, output: result.stdout, language, isCode: !isPatch, isPatch, error: result.error };
  }

  return { success: false, error: `logicType không hỗ trợ: ${logicType}` };
}

function formatOutput(tpl, vars, kq) {
  return formatOutputTpl(tpl, vars, kq);
}

module.exports = {
  patternToRegex, matchPattern, runLogic, formatOutput,
  normalizeQuery, detectLangFromCode, isRunnableLang, parseNum,
  levenshtein, similarity, fuzzyEqual, removeDiacritics, fixSpelling,
  STOPWORDS, SPELL_FIX,
  chayCayQuyetDinh, chayLogicVoiVars, evalCondition,
  extractVarsTheoCategory, extractVarsMath, extractVarsCode,
  extractVarsBugfix, extractVarsExplain, extractNumbers,
  formatOutputTpl, fixDynamicSum, safeEvalMathjs,
};