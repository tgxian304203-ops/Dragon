/* ═══════════════════════════════════════════════════════════════
   📚 KHO TRI THỨC — Search với Synonym + N-gram + Scoring
   ═══════════════════════════════════════════════════════════════ */

const { getTipModel } = require('../models/tip.model');
const logger = require('../utils/logger');

// ═══ SYNONYM MAP — mở rộng từ đồng nghĩa ═══
const SYNONYM_MAP = {
  // Bugfix
  'sửa': ['fix', 'debug', 'sửa lỗi', 'khắc phục', 'sửa chữa'],
  'fix': ['sửa', 'debug', 'sửa lỗi', 'khắc phục'],
  'debug': ['sửa', 'fix', 'gỡ lỗi', 'sửa lỗi'],
  'lỗi': ['bug', 'error', 'sai', 'hỏng', 'sự cố'],
  'bug': ['lỗi', 'error', 'sai'],
  'error': ['lỗi', 'bug', 'sai'],
  'sai': ['lỗi', 'bug', 'sai sót', 'không đúng'],

  // Code
  'viết': ['tạo', 'code', 'lập trình', 'xây dựng'],
  'code': ['viết code', 'lập trình', 'script', 'chương trình'],
  'tạo': ['viết', 'xây dựng', 'lập'],
  'hàm': ['function', 'method', 'phương thức'],
  'function': ['hàm', 'method'],
  'lập trình': ['code', 'viết code', 'programming'],

  // Math
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

  // Explain
  'giải thích': ['tại sao', 'vì sao', 'lý do', 'nguyên nhân', 'như thế nào'],
  'tại sao': ['vì sao', 'lý do', 'nguyên nhân'],
  'khái niệm': ['định nghĩa', 'lý thuyết'],

  // Operators
  '+': ['cộng', 'tổng', 'addition', 'sum'],
  '-': ['trừ', 'hiệu', 'subtraction'],
  '*': ['nhân', 'tích', 'multiplication'],
  'x': ['nhân', 'tích', 'multiplication'],
  '/': ['chia', 'thương', 'division'],
};

const OPERATIONS = new Set(['+', '-', '*', 'x', '/', '=']);

const STOP_WORDS = new Set([
  'là', 'của', 'và', 'có', 'không', 'được', 'cho', 'với', 'thì', 'mà',
  'này', 'kia', 'đó', 'tôi', 'mình', 'bạn', 'em', 'anh', 'chị',
  'gì', 'sao', 'nào', 'đâu', 'khi', 'thế', 'ạ', 'à', 'nhé', 'nha',
  'the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'to', 'of', 'in',
  'muốn', 'cần', 'giúp', 'giùm', 'làm', 'và', 'hay', 'hoặc',
]);

// ═══ INTENT DETECTION ═══
function detectIntent(query) {
  const q = query.toLowerCase();

  if (/\b(sửa|fix|debug|lỗi|bug|error|sai|hỏng|khắc phục|gỡ lỗi)\b/i.test(q)) {
    return 'bugfix';
  }
  if (/\b(viết|tạo|code|lập trình|hàm|function|script|chương trình|xây dựng)\b/i.test(q)) {
    return 'code';
  }
  if (/\b(tính|toán|phép|cộng|trừ|nhân|chia|tổng|hiệu|tích|thương|giải phương trình|[+\-*/=])\b/i.test(q)) {
    return 'math';
  }
  if (/\b(giải thích|tại sao|vì sao|là gì|khái niệm|định nghĩa|như thế nào|lý do|nguyên nhân)\b/i.test(q)) {
    return 'explain';
  }
  return 'general';
}

// ═══ TOKENIZE ═══
function tokenize(text) {
  return (text || '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .split(/\s+/)
    .filter((w) => w.length >= 2 && !STOP_WORDS.has(w));
}

// ═══ EXPAND SYNONYM ═══
function expandSynonyms(tokens) {
  const expanded = new Set(tokens);

  for (const t of tokens) {
    // Tra synonym map trực tiếp
    const syns = SYNONYM_MAP[t];
    if (syns) {
      syns.forEach((s) => expanded.add(s));
    }

    // Cũng kiểm tra các từ đơn trong từ ghép (VD: "sửa lỗi" → "sửa", "lỗi")
    const parts = t.split(/\s+/);
    if (parts.length > 1) {
      for (const p of parts) {
        if (SYNONYM_MAP[p]) {
          SYNONYM_MAP[p].forEach((s) => expanded.add(s));
        }
      }
    }
  }

  return [...expanded];
}

// ═══ EXTRACT N-GRAM (cụm 2-3 từ liền kề) ═══
function extractNgrams(query, maxN = 3) {
  const words = (query || '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .split(/\s+/)
    .filter((w) => w.length >= 2);

  const ngrams = [];

  for (let n = 2; n <= maxN; n++) {
    for (let i = 0; i <= words.length - n; i++) {
      const gram = words.slice(i, i + n).join(' ');
      ngrams.push(gram);
    }
  }

  return ngrams;
}

// ═══ SCORING ═══
/**
 * Tính điểm 1 TIP với câu hỏi user
 * @param {object} tip
 * @param {object} ctx - { tokens, synonyms, ngrams, intent }
 */
function scoreTIP(tip, ctx) {
  let score = 0;

  const tipKeywords = (tip.keywords || []).map((k) => k.toLowerCase());
  const tipNguyenLy = (tip.nguyenLy || '').toLowerCase();
  const tipPhuongPhap = (tip.phuongPhap || '').toLowerCase();
  const tipThuatToan = (tip.thuatToan || '').toLowerCase();
  const tipDieuKien = (tip.dieuKien || '').toLowerCase();
  const tipCategory = (tip.category || 'general').toLowerCase();

  // 1. Category match với intent (+10)
  if (ctx.intent !== 'general' && tipCategory === ctx.intent) {
    score += 10;
  }

  // 2. Keyword match chính xác (+5 mỗi từ, tối đa 20)
  let kwHits = 0;
  for (const kw of tipKeywords) {
    if (ctx.synonyms.includes(kw) || ctx.tokens.includes(kw)) {
      kwHits++;
    }
  }
  score += Math.min(20, kwHits * 5);

  // 3. Token match trong các trường (weighted)
  let nguyenLyHits = 0;
  for (const t of ctx.tokens) {
    if (tipNguyenLy.includes(t)) nguyenLyHits++;
  }
  score += Math.min(15, nguyenLyHits * 3);

  let phuongPhapHits = 0;
  for (const t of ctx.tokens) {
    if (tipPhuongPhap.includes(t)) phuongPhapHits++;
  }
  score += Math.min(10, phuongPhapHits * 2);

  let thuatToanHits = 0;
  for (const t of ctx.tokens) {
    if (tipThuatToan.includes(t)) thuatToanHits++;
  }
  score += Math.min(8, thuatToanHits);

  // 4. N-gram match (+8 mỗi cụm, tối đa 16)
  let ngramHits = 0;
  const fullText = `${tipNguyenLy} ${tipPhuongPhap} ${tipThuatToan} ${tipDieuKien} ${tipKeywords.join(' ')}`;
  for (const gram of ctx.ngrams) {
    if (fullText.includes(gram)) ngramHits++;
  }
  score += Math.min(16, ngramHits * 8);

  // 5. Quality score (+0.05 × quality)
  score += (tip.qualityScore || 0) * 0.05;

  return Math.round(score * 100) / 100;
}

// ═══ SEARCH ═══
/**
 * Search + scoring, trả về danh sách TIP đã sắp theo điểm
 * @param {string} query
 * @param {object} options - { limit = 10, minScore = 20, intent = null }
 */
async function searchTIP(query, options = {}) {
  const limit = options.limit || 10;
  const minScore = options.minScore ?? 20;
  const forcedIntent = options.intent || null;

  if (typeof query !== 'string' || query.trim() === '') return [];

  const Tip = getTipModel();

  // 1. Phân tích câu hỏi
  const tokens = tokenize(query);
  const intent = forcedIntent || detectIntent(query);
  const synonyms = expandSynonyms(tokens);
  const ngrams = extractNgrams(query, 3);

  logger.debug(`Search: tokens=[${tokens.join(',')}] intent=${intent} synonyms=${synonyms.length} ngrams=${ngrams.length}`);

  // 2. Query thô từ MongoDB — lấy nhiều hơn để scoring
  const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  const conditions = [];

  if (synonyms.length > 0) {
    conditions.push({ keywords: { $in: synonyms } });
  }

  // Regex nguyenLy từ tokens gốc
  for (const t of tokens.slice(0, 8)) {
    if (t.length >= 2) {
      conditions.push({ nguyenLy: new RegExp(escapeRegex(t), 'i') });
    }
  }

  // Regex từ synonyms
  for (const s of synonyms.slice(0, 8)) {
    if (s.length >= 2 && !tokens.includes(s)) {
      conditions.push({ nguyenLy: new RegExp(escapeRegex(s), 'i') });
    }
  }

  // Category filter nếu intent rõ
  if (intent !== 'general') {
    conditions.push({ category: intent });
  }

  let candidates = [];

  if (conditions.length === 0) {
    // Fallback — lấy TIP mới nhất
    candidates = await Tip.find({}).sort({ createdAt: -1 }).limit(limit * 2).lean();
  } else {
    candidates = await Tip.find({ $or: conditions })
      .limit(limit * 3)
      .lean();
  }

  // 3. Scoring từng TIP
  const ctx = { tokens, synonyms, ngrams, intent };
  const scored = candidates.map((tip) => ({
    ...tip,
    _score: scoreTIP(tip, ctx),
  }));

  // 4. Sắp theo điểm giảm dần
  scored.sort((a, b) => b._score - a._score);

  // 5. Lọc ngưỡng
  const passed = scored.filter((t) => t._score >= minScore);

  logger.debug(`Kho 2: ${candidates.length} thô → ${passed.length} pass (≥${minScore})`);

  if (passed.length > 0) {
    logger.debug(`Top 3: ${passed.slice(0, 3).map((t) => `${t.category}(${t._score})`).join(', ')}`);
  }

  // Trả về TIP đã pass, tối đa `limit`
  return passed.slice(0, limit).map(({ _score, ...tip }) => tip);
}

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
  });

  logger.success(`Lưu TIP Kho 2: ${tip._id} [${tip.category}]`);
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