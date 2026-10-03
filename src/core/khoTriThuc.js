/* ═══════════════════════════════════════════════════════════════
   📚 KHO TRI THỨC — Search TIP theo ngữ nghĩa + fuzzy
   - Lọc cứng theo intent + bỏ TIP deprecated
   - Phạt nặng TIP không match pattern
   - Bonus TIP có logicType khớp intent
   - Fuzzy keyword + token match (JS thuần)
   ═══════════════════════════════════════════════════════════════ */

const { getTipModel } = require('../models/tip.model');
const {
  matchPattern,
  fuzzyEqual,
  removeDiacritics,
} = require('./logicRunner');
const logger = require('../utils/logger');

/* ═══════════════════════════════════════════════════════════════
   SYNONYM MAP — mở rộng
   ═══════════════════════════════════════════════════════════════ */

const SYNONYM_MAP = {
  /* ═══ Sửa lỗi ═══ */
  'sửa': ['fix', 'debug', 'sửa lỗi', 'khắc phục', 'sua'],
  'fix': ['sửa', 'debug', 'sửa lỗi', 'bugfix'],
  'debug': ['sửa', 'fix', 'gỡ lỗi'],
  'lỗi': ['bug', 'error', 'sai', 'hỏng', 'loi'],
  'bug': ['lỗi', 'error', 'sai'],
  'error': ['lỗi', 'bug', 'sai'],
  'sai': ['lỗi', 'bug', 'sai sót'],

  /* ═══ Code ═══ */
  'viết': ['tạo', 'code', 'lập trình', 'xây dựng', 'viet'],
  'code': ['viết code', 'lập trình', 'script', 'program', 'hàm'],
  'tạo': ['viết', 'xây dựng', 'lập', 'tao'],
  'hàm': ['function', 'method', 'ham'],
  'function': ['hàm', 'method'],
  'lập trình': ['code', 'programming', 'lap trinh'],

  /* ═══ Toán ═══ */
  'tính': ['toán', 'tính toán', 'giải', 'kết quả', 'tinh', 'calculate', 'compute'],
  'toán': ['tính', 'tính toán', 'phép tính', 'toan', 'math'],
  'cộng': ['tổng', 'addition', 'sum', '+', 'cộng lại', 'plus', 'cong', 'add'],
  'trừ': ['hiệu', 'subtraction', '-', 'trừ đi', 'bớt', 'minus', 'tru', 'subtract'],
  'nhân': ['tích', 'multiplication', '*', 'x', '×', 'nhân với', 'times', 'multiply', 'nhan'],
  'chia': ['thương', 'division', '/', 'chia cho', 'divide', 'chia'],
  'tổng': ['cộng', 'sum', 'tong'],
  'hiệu': ['trừ', 'difference', 'hieu'],
  'tích': ['nhân', 'product', 'tich'],
  'thương': ['chia', 'quotient', 'thuong'],
  'mũ': ['lũy thừa', 'power', '^', 'exponent', 'mu'],
  'lũy thừa': ['mũ', 'power'],

  /* ═══ Giải thích ═══ */
  'giải thích': ['tại sao', 'vì sao', 'lý do', 'nguyên nhân', 'explain'],
  'tại sao': ['vì sao', 'lý do', 'nguyên nhân', 'why'],
  'khái niệm': ['định nghĩa', 'lý thuyết', 'concept'],

  /* ═══ Ký hiệu ═══ */
  '+': ['cộng', 'tổng', 'addition', 'sum', 'plus'],
  '-': ['trừ', 'hiệu', 'subtraction', 'minus'],
  '*': ['nhân', 'tích', 'multiplication', 'times'],
  'x': ['nhân', 'tích', 'multiplication'],
  '×': ['nhân', 'tích', 'multiplication'],
  '/': ['chia', 'thương', 'division', 'divide'],
  '^': ['mũ', 'lũy thừa', 'power'],
};

const STOP_WORDS = new Set([
  'là', 'của', 'và', 'có', 'không', 'được', 'cho', 'với', 'thì', 'mà',
  'này', 'kia', 'đó', 'tôi', 'mình', 'bạn', 'em', 'anh', 'chị',
  'gì', 'sao', 'nào', 'đâu', 'khi', 'thế', 'ạ', 'à', 'nhé', 'nha',
  'the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'to', 'of', 'in',
  'muốn', 'cần', 'giúp', 'giùm', 'làm', 'hay', 'hoặc',
  'bằng', 'mấy', 'bao', 'nhiêu', 'vậy', 'ra',
  'tính', 'hộ', 'dùm', 'giùm',
]);

/* ═══════════════════════════════════════════════════════════════
   DETECT INTENT
   ═══════════════════════════════════════════════════════════════ */

function detectIntent(query) {
  const q = query.toLowerCase();
  if (/\b(sửa|fix|debug|lỗi|bug|error|sai|hỏng|khắc phục|gỡ lỗi|sua)\b/i.test(q)) return 'bugfix';
  if (/\b(viết|tạo|code|lập trình|hàm|function|script|chương trình|xây dựng|viet|tao|ham)\b/i.test(q)) return 'code';
  if (/\b(tính|toán|phép|cộng|trừ|nhân|chia|tổng|hiệu|tích|thương|mũ|giải phương trình|[+\-*/=^]|tinh|cong|tru|nhan)\b/i.test(q)) return 'math';
  if (/\b(giải thích|tại sao|vì sao|là gì|khái niệm|định nghĩa|như thế nào|lý do|nguyên nhân)\b/i.test(q)) return 'explain';
  return 'general';
}

/* ═══════════════════════════════════════════════════════════════
   TOKENIZE
   ═══════════════════════════════════════════════════════════════ */

function tokenize(text) {
  if (!text) return [];
  const s = String(text).toLowerCase();

  // Chuẩn hóa số thập phân
  const normalized = s.replace(/(\d),(\d)/g, '$1.$2');

  const cleaned = normalized.replace(/[^\p{L}\p{N}\s+\-*/^=().]/gu, ' ');

  return cleaned
    .split(/\s+/)
    .filter((w) => {
      if (w.length < 1) return false;
      if (/^[+\-*/^=()]$/.test(w)) return true;
      if (/^\d+(?:\.\d+)?$/.test(w)) return true;
      return w.length >= 2 && !STOP_WORDS.has(w);
    });
}

function expandSynonyms(tokens) {
  const expanded = new Set(tokens);
  for (const t of tokens) {
    const syns = SYNONYM_MAP[t];
    if (syns) syns.forEach((s) => expanded.add(s));
    const parts = t.split(/\s+/);
    if (parts.length > 1) {
      for (const p of parts) {
        if (SYNONYM_MAP[p]) SYNONYM_MAP[p].forEach((s) => expanded.add(s));
      }
    }
  }
  return [...expanded];
}

function extractNgrams(query, maxN = 3) {
  const normalized = (query || '').toLowerCase().replace(/(\d),(\d)/g, '$1.$2');

  const words = normalized
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .split(/\s+/)
    .filter((w) => w.length >= 2);

  const ngrams = [];
  for (let n = 2; n <= maxN; n++) {
    for (let i = 0; i <= words.length - n; i++) {
      ngrams.push(words.slice(i, i + n).join(' '));
    }
  }
  return ngrams;
}

/* ═══════════════════════════════════════════════════════════════
   SCORE TIP
   ═══════════════════════════════════════════════════════════════ */

function intentCanLogic(intent) {
  return ['math', 'code', 'bugfix'].includes(intent);
}

/**
 * Đếm số keyword khớp exact HOẶC fuzzy.
 */
function countKeywordHits(tipKeywords, ctx) {
  let hits = 0;
  for (const kw of tipKeywords) {
    // Exact
    if (ctx.synonyms.includes(kw) || ctx.tokens.includes(kw)) {
      hits++;
      continue;
    }
    // Fuzzy — so với từng token user
    let fuzzyHit = false;
    for (const tok of ctx.tokens) {
      if (fuzzyEqual(kw, tok, 0.8)) {
        fuzzyHit = true;
        break;
      }
    }
    if (fuzzyHit) hits++;
  }
  return hits;
}

/**
 * Đếm số token user khớp exact HOẶC fuzzy với text TIP.
 */
function countTokenHits(tipText, ctx) {
  let hits = 0;
  const tipWords = tipText.split(/\s+/).filter((w) => w.length >= 2);

  for (const tok of ctx.tokens) {
    if (tok.length < 2) continue;
    if (tipText.includes(tok)) {
      hits++;
      continue;
    }
    // Fuzzy
    for (const tw of tipWords) {
      if (fuzzyEqual(tok, tw, 0.8)) {
        hits++;
        break;
      }
    }
  }
  return hits;
}

function scoreTIP(tip, ctx) {
  let score = 0;

  const tipKeywords = (tip.keywords || []).map((k) => String(k).toLowerCase());
  const tipText = [
    tip.nguyenLy, tip.quyTac, tip.dieuKien, tip.cayQuyetDinh,
    tip.phuongPhap, tip.thuatToan, tip.workflow, tip.suyLuan,
    tip.testCase, tip.kiemChung, tip.ngoaiLe, tip.caseKinhNghiem,
    tipKeywords.join(' '),
  ].filter(Boolean).join(' ').toLowerCase();

  const tipCategory = String(tip.category || 'general').toLowerCase();
  const tipLogicType = String(tip.logicType || '').toLowerCase();

  /* ═══ Điểm category ═══ */
  if (ctx.intent !== 'general') {
    if (tipCategory === ctx.intent) score += 30;
    else if (tipCategory === 'general') score += 5;
    else score -= 50;
  } else {
    score += 5;
  }

  /* ═══ Bonus logicType khớp intent ═══ */
  if (ctx.intent === 'math' && tipLogicType === 'expr') score += 40;
  if (ctx.intent === 'code' && (tipLogicType === 'code' || tipLogicType === 'patch')) score += 40;
  if (ctx.intent === 'bugfix' && tipLogicType === 'patch') score += 40;

  /* ═══ Phạt TIP không có logic khi intent cần logic ═══ */
  if (intentCanLogic(ctx.intent) && !tipLogicType) score -= 30;

  /* ═══ [MỚI] Keyword khớp exact + fuzzy ═══ */
  const kwHits = countKeywordHits(tipKeywords, ctx);
  score += Math.min(60, kwHits * 30);

  /* ═══ [MỚI] Token khớp exact + fuzzy ═══ */
  const tokenHits = countTokenHits(tipText, ctx);
  score += Math.min(20, tokenHits * 3);

  /* ═══ Ngram khớp ═══ */
  let ngramHits = 0;
  for (const gram of ctx.ngrams) {
    if (tipText.includes(gram)) ngramHits++;
  }
  score += Math.min(16, ngramHits * 8);

  /* ═══ Quality ═══ */
  score += (tip.qualityScore || 0) * 0.05;

  return Math.round(score * 100) / 100;
}

/* ═══════════════════════════════════════════════════════════════
   SEARCH TIP
   ═══════════════════════════════════════════════════════════════ */

async function searchTIP(query, options = {}) {
  const limit = options.limit || 10;
  const minScore = options.minScore ?? 15;
  const forcedIntent = options.intent || null;

  if (typeof query !== 'string' || query.trim() === '') return [];

  const Tip = getTipModel();

  const tokens = tokenize(query);
  const intent = forcedIntent || detectIntent(query);
  const synonyms = expandSynonyms(tokens);
  const ngrams = extractNgrams(query, 3);

  logger.debug(`Search: intent=${intent} tokens=[${tokens.slice(0, 8).join(',')}]`);

  let candidates = [];
  try {
    // [MỚI] Bỏ TIP deprecated
    candidates = await Tip.find({ isDeprecated: { $ne: true } })
      .limit(limit * 10)
      .lean();
  } catch (err) {
    logger.warn(`Query TIP lỗi: ${err.message}`);
    return [];
  }

  const ctx = { tokens, synonyms, ngrams, intent };

  const scored = candidates.map((tip) => {
    let score = 0;
    let patternMatched = false;
    let fuzzyMatched = false;

    if (Array.isArray(tip.patterns) && tip.patterns.length > 0) {
      try {
        const vars = matchPattern(tip.patterns, query);
        if (vars) {
          score += 100;
          patternMatched = true;

          // Nếu là fuzzy match → cộng ít hơn
          if (vars._fuzzy) {
            fuzzyMatched = true;
            score = 100 - 30; // fuzzy → 70 thay vì 100
            logger.debug(`Fuzzy pattern match TIP ${tip._id}: +70`);
          } else {
            logger.debug(`Regex pattern match TIP ${tip._id}: +100`);
          }
        } else {
          score -= 200;
        }
      } catch (err) {
        logger.warn(`Pattern check lỗi TIP ${tip._id}: ${err.message}`);
      }
    }

    score += scoreTIP(tip, ctx);

    return { ...tip, _score: score, _patternMatched: patternMatched, _fuzzyMatched: fuzzyMatched };
  });

  // Lọc cứng theo intent
  let filtered = scored;
  if (intent !== 'general') {
    filtered = scored.filter((t) => {
      const cat = String(t.category || 'general').toLowerCase();
      return cat === intent || cat === 'general';
    });
  }

  filtered.sort((a, b) => b._score - a._score);

  const passed = filtered.filter((t) => t._score >= minScore);

  logger.debug(
    `Kho 2: ${candidates.length} thô → ${filtered.length} sau lọc intent=${intent} → ${passed.length} pass (≥${minScore})`
  );

  return passed.slice(0, limit).map(({ _score, _patternMatched, _fuzzyMatched, ...tip }) => tip);
}

/* ═══════════════════════════════════════════════════════════════
   SAVE TIP
   ═══════════════════════════════════════════════════════════════ */

async function saveTIP(tipData) {
  if (!tipData || !tipData.nguyenLy || tipData.nguyenLy.trim() === '') {
    throw new Error('TIP thiếu nguyenLy');
  }

  const Tip = getTipModel();

  const tip = await Tip.create({
    nguyenLy: tipData.nguyenLy || '',
    quyTac: tipData.quyTac || '',
    dieuKien: tipData.dieuKien || '',
    cayQuyetDinh: tipData.cayQuyetDinh || '',
    phuongPhap: tipData.phuongPhap || '',
    thuatToan: tipData.thuatToan || '',
    workflow: tipData.workflow || '',
    suyLuan: tipData.suyLuan || '',
    testCase: tipData.testCase || '',
    kiemChung: tipData.kiemChung || '',
    ngoaiLe: tipData.ngoaiLe || '',
    caseKinhNghiem: tipData.caseKinhNghiem || '',
    quanHe: tipData.quanHe || [],
    nguonPhienBan: tipData.nguonPhienBan || '',
    category: tipData.category || 'general',
    keywords: tipData.keywords || [],
    qualityScore: tipData.qualityScore || 0,
    patterns: tipData.patterns || [],
    logicType: tipData.logicType || '',
    logicValue: tipData.logicValue || '',
    outputTpl: tipData.outputTpl || '',
    tests: tipData.tests || [],
    // Feedback fields mặc định
    usageCount: 0,
    successCount: 0,
    failCount: 0,
    lastUsedAt: null,
    version: 1,
    mergedFrom: [],
    isDeprecated: false,
    deprecatedReason: '',
  });

  logger.success(
    `Lưu TIP Kho 2: ${tip._id} [${tip.category}] ` +
    `patterns=${(tip.patterns || []).length}, logicType=${tip.logicType}`
  );
  return tip;
}

async function getTIPById(id) {
  return getTipModel().findById(id).lean();
}

async function countTIP() {
  return getTipModel().countDocuments();
}

module.exports = {
  searchTIP,
  saveTIP,
  getTIPById,
  countTIP,
  detectIntent,
  extractNgrams,
  expandSynonyms,
  scoreTIP,
  tokenize,
  intentCanLogic,
  // [MỚI]
  countKeywordHits,
  countTokenHits,
};