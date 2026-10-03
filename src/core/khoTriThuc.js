/* ═══════════════════════════════════════════════════════════════
   📚 KHO TRI THỨC — Search match pattern + keyword
   ═══════════════════════════════════════════════════════════════ */

const { getTipModel } = require('../models/tip.model');
const { matchPattern } = require('./logicRunner');
const logger = require('../utils/logger');

// ═══ SYNONYM MAP ═══
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
  'cộng': ['tổng', 'addition', 'sum', '+'],
  'trừ': ['hiệu', 'subtraction', '-'],
  'nhân': ['tích', 'multiplication', '*'],
  'chia': ['thương', 'division', '/'],
  'tổng': ['cộng', 'sum'],
  'hiệu': ['trừ', 'difference'],
  'tích': ['nhân', 'product'],
  'thương': ['chia', 'quotient'],

  'giải thích': ['tại sao', 'vì sao', 'lý do', 'nguyên nhân'],
  'tại sao': ['vì sao', 'lý do', 'nguyên nhân'],
  'khái niệm': ['định nghĩa', 'lý thuyết'],

  '+': ['cộng', 'tổng', 'addition', 'sum'],
  '-': ['trừ', 'hiệu', 'subtraction'],
  '*': ['nhân', 'tích', 'multiplication'],
  'x': ['nhân', 'tích', 'multiplication'],
  '/': ['chia', 'thương', 'division'],
  '^': ['mũ', 'lũy thừa', 'power'],
};

const STOP_WORDS = new Set([
  'là', 'của', 'và', 'có', 'không', 'được', 'cho', 'với', 'thì', 'mà',
  'này', 'kia', 'đó', 'tôi', 'mình', 'bạn', 'em', 'anh', 'chị',
  'gì', 'sao', 'nào', 'đâu', 'khi', 'thế', 'ạ', 'à', 'nhé', 'nha',
  'the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'to', 'of', 'in',
  'muốn', 'cần', 'giúp', 'giùm', 'làm', 'hay', 'hoặc',
  'bằng', 'mấy', 'bao', 'nhiêu', 'vậy', 'thì', 'ra',
]);

// ═══ INTENT ═══
function detectIntent(query) {
  const q = query.toLowerCase();
  if (/\b(sửa|fix|debug|lỗi|bug|error|sai|hỏng|khắc phục|gỡ lỗi)\b/i.test(q)) return 'bugfix';
  if (/\b(viết|tạo|code|lập trình|hàm|function|script|chương trình|xây dựng)\b/i.test(q)) return 'code';
  if (/\b(tính|toán|phép|cộng|trừ|nhân|chia|tổng|hiệu|tích|thương|giải phương trình|[+\-*/=^])\b/i.test(q)) return 'math';
  if (/\b(giải thích|tại sao|vì sao|là gì|khái niệm|định nghĩa|như thế nào|lý do|nguyên nhân)\b/i.test(q)) return 'explain';
  return 'general';
}

// ═══ TOKENIZE — giữ toán tử ═══
function tokenize(text) {
  if (!text) return [];

  const s = String(text).toLowerCase();

  // Giữ lại các ký tự: chữ, số, khoảng trắng, và các toán tử + - * / ^ = ( ) . 
  const cleaned = s.replace(/[^\p{L}\p{N}\s+\-*/^=().]/gu, ' ');

  return cleaned
    .split(/\s+/)
    .filter((w) => {
      if (w.length < 1) return false;
      // Toán tử đơn — giữ
      if (/^[+\-*/^=()]$/.test(w)) return true;
      // Số — giữ
      if (/^\d+(?:\.\d+)?$/.test(w)) return true;
      // Từ — bỏ stop words, độ dài >= 2
      return w.length >= 2 && !STOP_WORDS.has(w);
    });
}

// ═══ EXPAND SYNONYM ═══
function expandSynonyms(tokens) {
  const expanded = new Set(tokens);

  for (const t of tokens) {
    const syns = SYNONYM_MAP[t];
    if (syns) syns.forEach((s) => expanded.add(s));

    // Cũng thử map cho từng từ đơn trong cụm
    const parts = t.split(/\s+/);
    if (parts.length > 1) {
      for (const p of parts) {
        if (SYNONYM_MAP[p]) SYNONYM_MAP[p].forEach((s) => expanded.add(s));
      }
    }
  }

  return [...expanded];
}

// ═══ N-GRAM ═══
function extractNgrams(query, maxN = 3) {
  const words = (query || '')
    .toLowerCase()
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

// ═══ SCORE TIP ═══
function scoreTIP(tip, ctx) {
  let score = 0;

  const tipKeywords = (tip.keywords || []).map((k) => k.toLowerCase());
  const tipNguyenLy = (tip.nguyenLy || '').toLowerCase();
  const tipPhuongPhap = (tip.phuongPhap || '').toLowerCase();
  const tipThuatToan = (tip.thuatToan || '').toLowerCase();
  const tipDieuKien = (tip.dieuKien || '').toLowerCase();
  const tipCategory = (tip.category || 'general').toLowerCase();

  // Category match intent
  if (ctx.intent !== 'general' && tipCategory === ctx.intent) score += 10;

  // Keyword match
  let kwHits = 0;
  for (const kw of tipKeywords) {
    if (ctx.synonyms.includes(kw) || ctx.tokens.includes(kw)) kwHits++;
  }
  score += Math.min(20, kwHits * 5);

  // Token trong các trường
  let nguyenLyHits = 0;
  for (const t of ctx.tokens) if (tipNguyenLy.includes(t)) nguyenLyHits++;
  score += Math.min(15, nguyenLyHits * 3);

  let phuongPhapHits = 0;
  for (const t of ctx.tokens) if (tipPhuongPhap.includes(t)) phuongPhapHits++;
  score += Math.min(10, phuongPhapHits * 2);

  let thuatToanHits = 0;
  for (const t of ctx.tokens) if (tipThuatToan.includes(t)) thuatToanHits++;
  score += Math.min(8, thuatToanHits);

  // N-gram
  let ngramHits = 0;
  const fullText = `${tipNguyenLy} ${tipPhuongPhap} ${tipThuatToan} ${tipDieuKien} ${tipKeywords.join(' ')}`;
  for (const gram of ctx.ngrams) if (fullText.includes(gram)) ngramHits++;
  score += Math.min(16, ngramHits * 8);

  // Quality
  score += (tip.qualityScore || 0) * 0.05;

  return Math.round(score * 100) / 100;
}

// ═══ SEARCH ═══
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

  const escape = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  const conditions = [];

  if (synonyms.length > 0) conditions.push({ keywords: { $in: synonyms } });

  for (const t of tokens.slice(0, 10)) {
    if (t.length >= 2) {
      conditions.push({ nguyenLy: new RegExp(escape(t), 'i') });
    }
  }

  for (const s of synonyms.slice(0, 10)) {
    if (s.length >= 2 && !tokens.includes(s)) {
      conditions.push({ nguyenLy: new RegExp(escape(s), 'i') });
    }
  }

  if (intent !== 'general') conditions.push({ category: intent });

  let candidates = [];

  if (conditions.length === 0) {
    candidates = await Tip.find({}).sort({ createdAt: -1 }).limit(limit * 3).lean();
  } else {
    candidates = await Tip.find({ $or: conditions }).limit(limit * 5).lean();
  }

  // ═══ MATCH PATTERN — ưu tiên ═══
  const ctx = { tokens, synonyms, ngrams, intent };
  const scored = candidates.map((tip) => {
    let score = scoreTIP(tip, ctx);

    // Thử match pattern
    if (Array.isArray(tip.patterns) && tip.patterns.length > 0) {
      const vars = matchPattern(tip.patterns, query);
      if (vars) {
        score += 100; // Boost mạnh khi match pattern
        logger.debug(`Pattern match TIP ${tip._id}: score +100`);
      }
    }

    return { ...tip, _score: score, _patternMatched: score >= 100 };
  });

  scored.sort((a, b) => b._score - a._score);

  const passed = scored.filter((t) => t._score >= minScore);

  logger.debug(`Kho 2: ${candidates.length} thô → ${passed.length} pass (≥${minScore})`);

  return passed.slice(0, limit).map(({ _score, _patternMatched, ...tip }) => tip);
}

// ═══ SAVE ═══
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
    // 4 trường mới
    patterns: tipData.patterns || [],
    logicType: tipData.logicType || '',
    logicValue: tipData.logicValue || '',
    outputTpl: tipData.outputTpl || '',
  });

  logger.success(
    `Lưu TIP Kho 2: ${tip._id} [${tip.category}] patterns=${(tip.patterns || []).length}, logicType=${tip.logicType}`
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
};