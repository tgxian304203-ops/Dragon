/* ═══════════════════════════════════════════════════════════════
   📚 KHO TRI THỨC — Search TIP theo ngữ nghĩa
   - Lọc cứng theo intent
   - Phạt nặng TIP không match pattern khi câu user có logic
   - Bonus TIP có logicType khớp intent
   - Chuẩn hóa dấu phẩy cho số thập phân
   ═══════════════════════════════════════════════════════════════ */

const { getTipModel } = require('../models/tip.model');
const { matchPattern } = require('./logicRunner');
const logger = require('../utils/logger');

/* ═══════════════════════════════════════════════════════════════
   SYNONYM MAP
   ═══════════════════════════════════════════════════════════════ */

const SYNONYM_MAP = {
  'sửa': ['fix', 'debug', 'sửa lỗi', 'khắc phục'],
  'fix': ['sửa', 'debug', 'sửa lỗi'],
  'debug': ['sửa', 'fix', 'gỡ lỗi'],
  'lỗi': ['bug', 'error', 'sai', 'hỏng'],
  'bug': ['lỗi', 'error', 'sai'],
  'error': ['lỗi', 'bug', 'sai'],
  'sai': ['lỗi', 'bug', 'sai sót'],
  'viết': ['tạo', 'code', 'lập trình', 'xây dựng'],
  'code': ['viết code', 'lập trình', 'script'],
  'tạo': ['viết', 'xây dựng', 'lập'],
  'hàm': ['function', 'method'],
  'function': ['hàm', 'method'],
  'tính': ['toán', 'tính toán', 'giải', 'kết quả'],
  'toán': ['tính', 'tính toán', 'phép tính'],
  'cộng': ['tổng', 'addition', 'sum', '+', 'cộng lại'],
  'trừ': ['hiệu', 'subtraction', '-', 'trừ đi', 'bớt'],
  'nhân': ['tích', 'multiplication', '*', 'x', '×', 'nhân với'],
  'chia': ['thương', 'division', '/', 'chia cho'],
  'tổng': ['cộng', 'sum'],
  'hiệu': ['trừ', 'difference'],
  'tích': ['nhân', 'product'],
  'thương': ['chia', 'quotient'],
  'mũ': ['lũy thừa', 'power', '^'],
  'lũy thừa': ['mũ', 'power'],
  'giải thích': ['tại sao', 'vì sao', 'lý do', 'nguyên nhân'],
  'tại sao': ['vì sao', 'lý do', 'nguyên nhân'],
  'khái niệm': ['định nghĩa', 'lý thuyết'],
  '+': ['cộng', 'tổng', 'addition', 'sum'],
  '-': ['trừ', 'hiệu', 'subtraction'],
  '*': ['nhân', 'tích', 'multiplication'],
  'x': ['nhân', 'tích', 'multiplication'],
  '×': ['nhân', 'tích', 'multiplication'],
  '/': ['chia', 'thương', 'division'],
  '^': ['mũ', 'lũy thừa', 'power'],
};

const STOP_WORDS = new Set([
  'là', 'của', 'và', 'có', 'không', 'được', 'cho', 'với', 'thì', 'mà',
  'này', 'kia', 'đó', 'tôi', 'mình', 'bạn', 'em', 'anh', 'chị',
  'gì', 'sao', 'nào', 'đâu', 'khi', 'thế', 'ạ', 'à', 'nhé', 'nha',
  'the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'to', 'of', 'in',
  'muốn', 'cần', 'giúp', 'giùm', 'làm', 'hay', 'hoặc',
  'bằng', 'mấy', 'bao', 'nhiêu', 'vậy', 'ra',
]);

/* ═══════════════════════════════════════════════════════════════
   DETECT INTENT
   ═══════════════════════════════════════════════════════════════ */

function detectIntent(query) {
  const q = query.toLowerCase();
  if (/\b(sửa|fix|debug|lỗi|bug|error|sai|hỏng|khắc phục|gỡ lỗi)\b/i.test(q)) return 'bugfix';
  if (/\b(viết|tạo|code|lập trình|hàm|function|script|chương trình|xây dựng)\b/i.test(q)) return 'code';
  if (/\b(tính|toán|phép|cộng|trừ|nhân|chia|tổng|hiệu|tích|thương|giải phương trình|[+\-*/=^])\b/i.test(q)) return 'math';
  if (/\b(giải thích|tại sao|vì sao|là gì|khái niệm|định nghĩa|như thế nào|lý do|nguyên nhân)\b/i.test(q)) return 'explain';
  return 'general';
}

/* ═══════════════════════════════════════════════════════════════
   TOKENIZE — chuẩn hóa dấu phẩy cho số thập phân
   ═══════════════════════════════════════════════════════════════ */

function tokenize(text) {
  if (!text) return [];
  const s = String(text).toLowerCase();

  // Chuẩn hóa: 7,6 → 7.6 (tránh tách dấu phẩy thành token riêng)
  const normalized = s.replace(/(\d),(\d)/g, '$1.$2');

  const cleaned = normalized.replace(/[^\p{L}\p{N}\s+\-*/^=().]/gu, ' ');

  return cleaned
    .split(/\s+/)
    .filter((w) => {
      if (w.length < 1) return false;
      if (/^[+\-*/^=()]$/.test(w)) return true;
      if (/^\d+(?:\.\d+)?$/.test(w)) return true; // số nguyên hoặc thập phân
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
  // Chuẩn hóa dấu phẩy trước khi extract ngram
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

/**
 * Kiểm tra intent có cần logic không (math/code/bugfix).
 */
function intentCanLogic(intent) {
  return ['math', 'code', 'bugfix'].includes(intent);
}

/**
 * Chấm điểm TIP theo intent + keyword + token + ngram + logicType.
 */
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

  /* ═══ [MỚI] Bonus logicType khớp intent ═══ */
  if (ctx.intent === 'math' && tipLogicType === 'expr') score += 40;
  if (ctx.intent === 'code' && (tipLogicType === 'code' || tipLogicType === 'patch')) score += 40;
  if (ctx.intent === 'bugfix' && tipLogicType === 'patch') score += 40;

  /* ═══ [MỚI] Phạt TIP không có logic khi intent cần logic ═══ */
  if (intentCanLogic(ctx.intent) && !tipLogicType) {
    score -= 30;
  }

  /* ═══ Keyword khớp qua synonym ═══ */
  let kwHits = 0;
  for (const kw of tipKeywords) {
    if (ctx.synonyms.includes(kw)) kwHits++;
  }
  score += Math.min(60, kwHits * 30);

  /* ═══ Token khớp trực tiếp ═══ */
  let tokenHits = 0;
  for (const t of ctx.tokens) {
    if (tipText.includes(t)) tokenHits++;
  }
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
    candidates = await Tip.find({}).limit(limit * 10).lean();
  } catch (err) {
    logger.warn(`Query TIP lỗi: ${err.message}`);
    return [];
  }

  const ctx = { tokens, synonyms, ngrams, intent };

  const scored = candidates.map((tip) => {
    let score = 0;
    let patternMatched = false;

    // Match pattern + phạt nặng nếu có patterns nhưng không match
    if (Array.isArray(tip.patterns) && tip.patterns.length > 0) {
      try {
        const vars = matchPattern(tip.patterns, query);
        if (vars) {
          score += 100;
          patternMatched = true;
          logger.debug(`Pattern match TIP ${tip._id}: +100`);
        } else {
          score -= 200;
        }
      } catch (err) {
        logger.warn(`Pattern check lỗi TIP ${tip._id}: ${err.message}`);
      }
    }

    score += scoreTIP(tip, ctx);

    return { ...tip, _score: score, _patternMatched: patternMatched };
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

  return passed.slice(0, limit).map(({ _score, _patternMatched, ...tip }) => tip);
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
};