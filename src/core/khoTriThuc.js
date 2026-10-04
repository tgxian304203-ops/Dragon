/* ═══════════════════════════════════════════════════════════════
   📚 KHO TRI THỨC
   - searchTIP nhận langCan từ ngoài + lọc chặt
   - saveTIP lưu cayQuyetDinhJson
   ═══════════════════════════════════════════════════════════════ */

const { getTipModel } = require('../models/tip.model');
const { matchPattern, fuzzyEqual, removeDiacritics, detectLangFromCode } = require('./logicRunner');
const logger = require('../utils/logger');

const SYNONYM_MAP = {
  'sửa': ['fix', 'debug', 'sửa lỗi', 'khắc phục', 'sua'],
  'fix': ['sửa', 'debug', 'sửa lỗi', 'bugfix'],
  'debug': ['sửa', 'fix', 'gỡ lỗi'],
  'lỗi': ['bug', 'error', 'sai', 'hỏng', 'loi'],
  'bug': ['lỗi', 'error', 'sai'],
  'viết': ['tạo', 'code', 'lập trình', 'xây dựng', 'viet'],
  'code': ['viết code', 'lập trình', 'script', 'program', 'hàm'],
  'tạo': ['viết', 'xây dựng', 'lập', 'tao'],
  'hàm': ['function', 'method', 'ham'],
  'tính': ['toán', 'tính toán', 'giải', 'kết quả', 'tinh'],
  'toán': ['tính', 'tính toán', 'phép tính', 'toan', 'math'],
  'cộng': ['tổng', 'addition', 'sum', '+', 'cộng lại', 'plus', 'cong', 'add'],
  'trừ': ['hiệu', 'subtraction', '-', 'trừ đi', 'bớt', 'minus', 'tru'],
  'nhân': ['tích', 'multiplication', '*', 'x', '×', 'nhân với', 'times', 'nhan'],
  'chia': ['thương', 'division', '/', 'chia cho', 'divide'],
  'tổng': ['cộng', 'sum', 'tong'],
  'hiệu': ['trừ', 'difference', 'hieu'],
  'tích': ['nhân', 'product', 'tich'],
  'thương': ['chia', 'quotient', 'thuong'],
  'mũ': ['lũy thừa', 'power', '^', 'exponent'],
  'web': ['trang web', 'website', 'html', 'shop', 'landing', 'spck'],
  'shop': ['cửa hàng', 'bán hàng', 'web bán', 'html shop'],
  'html': ['web', 'trang web', 'website', 'css', 'js', 'spck'],
  'spck': ['html', 'web', 'trang web', 'app điện thoại'],
  '+': ['cộng', 'tổng', 'addition'],
  '-': ['trừ', 'hiệu', 'subtraction'],
  '*': ['nhân', 'tích', 'multiplication'],
  '/': ['chia', 'thương', 'division'],
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

/* [MỚI] Từ chung — không tính là keyword hit */
const GENERIC_WORDS = new Set([
  'tạo', 'viết', 'làm', 'code', 'lập trình', 'cho', 'với', 'của',
  'cái', 'một', 'các', 'những', 'thì', 'là', 'và', 'có',
  'create', 'make', 'build', 'write', 'code', 'program',
]);

function detectIntent(query) {
  const q = query.toLowerCase();
  if (/\b(sửa|fix|debug|lỗi|bug|error|sai|hỏng|khắc phục|gỡ lỗi|sua)\b/i.test(q)) return 'bugfix';
  if (/\b(viết|tạo|code|lập trình|hàm|function|script|chương trình|xây dựng|viet|tao|ham)\b/i.test(q)) return 'code';
  if (/\b(tính|toán|phép|cộng|trừ|nhân|chia|tổng|hiệu|tích|thương|mũ|giải phương trình|[+\-*/=^]|tinh|cong|tru|nhan)\b/i.test(q)) return 'math';
  if (/\b(giải thích|tại sao|vì sao|là gì|khái niệm|định nghĩa|như thế nào|lý do|nguyên nhân)\b/i.test(q)) return 'explain';
  return 'general';
}

function detectLangCan(query) {
  const q = String(query).toLowerCase();
  if (/\b(spck|html|web|shop|trang web|trang|landing|css|giao diện|\bui\b|frontend|front-end|website|cửa hàng|bán hàng)\b/.test(q)) return 'html';
  if (/\bpython\b|\bpy\b/.test(q)) return 'python';
  if (/\bjavascript\b|\bjs\b|\bnode\b|express/.test(q)) return 'javascript';
  if (/\bjava\b/.test(q) && !/javascript/.test(q)) return 'java';
  if (/c\+\+|cpp/.test(q)) return 'cpp';
  if (/\bgolang\b/.test(q)) return 'go';
  if (/\brust\b/.test(q)) return 'rust';
  if (/react native/.test(q)) return 'react-native';
  if (/\bflutter\b/.test(q)) return 'flutter';
  return null;
}

function kiemNgonNguKhop(tip, langCan) {
  if (!langCan) return true;
  if (!tip.logicValue) return true;

  const tipLang = detectLangFromCode(tip.logicValue);
  const alias = {
    'html': ['html', 'css'],
    'python': ['python'],
    'javascript': ['javascript'],
    'java': ['java'],
    'cpp': ['cpp'],
    'go': ['go'],
    'rust': ['rust'],
    'react-native': ['javascript'],
    'flutter': ['dart'],
  };
  const accepted = alias[langCan] || [langCan];
  return accepted.includes(tipLang);
}

function tokenize(text) {
  if (!text) return [];
  const s = String(text).toLowerCase();
  const normalized = s.replace(/(\d),(\d)/g, '$1.$2');
  const cleaned = normalized.replace(/[^\p{L}\p{N}\s+\-*/^=().]/gu, ' ');
  return cleaned.split(/\s+/).filter((w) => {
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
  }
  return [...expanded];
}

function extractNgrams(query, maxN = 3) {
  const normalized = (query || '').toLowerCase().replace(/(\d),(\d)/g, '$1.$2');
  const words = normalized.replace(/[^\p{L}\p{N}\s]/gu, ' ').split(/\s+/).filter((w) => w.length >= 2);
  const ngrams = [];
  for (let n = 2; n <= maxN; n++) {
    for (let i = 0; i <= words.length - n; i++) {
      ngrams.push(words.slice(i, i + n).join(' '));
    }
  }
  return ngrams;
}

function intentCanLogic(intent) {
  return ['math', 'code', 'bugfix'].includes(intent);
}

function countKeywordHits(tipKeywords, ctx) {
  let hits = 0;
  const specificKeywords = tipKeywords.filter((kw) => !GENERIC_WORDS.has(kw));
  for (const kw of specificKeywords) {
    if (ctx.synonyms.includes(kw) || ctx.tokens.includes(kw)) { hits++; continue; }
    let fuzzyHit = false;
    for (const tok of ctx.tokens) {
      if (fuzzyEqual(kw, tok, 0.8)) { fuzzyHit = true; break; }
    }
    if (fuzzyHit) hits++;
  }
  return { hits, total: specificKeywords.length };
}

function countTokenHits(tipText, ctx) {
  let hits = 0;
  const tipWords = tipText.split(/\s+/).filter((w) => w.length >= 2);
  for (const tok of ctx.tokens) {
    if (tok.length < 2) continue;
    if (tipText.includes(tok)) { hits++; continue; }
    for (const tw of tipWords) {
      if (fuzzyEqual(tok, tw, 0.8)) { hits++; break; }
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

  if (ctx.intent !== 'general') {
    if (tipCategory === ctx.intent) score += 30;
    else if (tipCategory === 'general') score += 5;
    else score -= 50;
  } else {
    score += 5;
  }

  if (ctx.intent === 'math' && tipLogicType === 'expr') score += 40;
  if (ctx.intent === 'code' && (tipLogicType === 'code' || tipLogicType === 'patch')) score += 40;
  if (ctx.intent === 'bugfix' && tipLogicType === 'patch') score += 40;

  if (intentCanLogic(ctx.intent) && !tipLogicType) score -= 30;

  const kw = countKeywordHits(tipKeywords, ctx);
  score += Math.min(60, kw.hits * 30);

  const tokenHits = countTokenHits(tipText, ctx);
  score += Math.min(20, tokenHits * 3);

  let ngramHits = 0;
  for (const gram of ctx.ngrams) {
    if (tipText.includes(gram)) ngramHits++;
  }
  score += Math.min(16, ngramHits * 8);

  score += (tip.qualityScore || 0) * 0.05;

  return Math.round(score * 100) / 100;
}

async function searchTIP(query, options = {}) {
  const limit = options.limit || 10;
  const minScore = options.minScore ?? 15;
  const forcedIntent = options.intent || null;
  const forcedLang = options.langCan || null;

  if (typeof query !== 'string' || query.trim() === '') return [];

  const Tip = getTipModel();
  const tokens = tokenize(query);
  const intent = forcedIntent || detectIntent(query);
  const synonyms = expandSynonyms(tokens);
  const ngrams = extractNgrams(query, 3);
  const langCan = forcedLang || detectLangCan(query);

  logger.debug(`Search: intent=${intent} langCan=${langCan || 'null'} tokens=[${tokens.slice(0, 8).join(',')}]`);

  let candidates = [];
  try {
    candidates = await Tip.find({ isDeprecated: { $ne: true } }).limit(limit * 10).lean();
  } catch (err) {
    logger.warn(`Query TIP lỗi: ${err.message}`);
    return [];
  }

  const ctx = { tokens, synonyms, ngrams, intent };

  const scored = candidates.map((tip) => {
    let score = 0;
    let patternMatched = false;
    let hasCay = false;
    let langKhop = true;

    if (tip.cayQuyetDinhJson && Array.isArray(tip.cayQuyetDinhJson.rules) && tip.cayQuyetDinhJson.rules.length > 0) {
      hasCay = true;
    }

    langKhop = kiemNgonNguKhop(tip, langCan);
    if (!langKhop) {
      score -= 500;
      logger.debug(`❌ TIP ${tip._id} sai ngôn ngữ`);
    }

    if (Array.isArray(tip.patterns) && tip.patterns.length > 0) {
      try {
        const vars = matchPattern(tip.patterns, query);
        if (vars && langKhop) {
          score += 100;
          patternMatched = true;
          if (vars._fuzzy) score = 100 - 30;
        } else if (!langKhop) {
          // không cộng
        } else {
          if (hasCay) score -= 20;
          else score -= 200;
        }
      } catch (err) {
        logger.warn(`Pattern check lỗi: ${err.message}`);
      }
    }

    score += scoreTIP(tip, ctx);

    return { ...tip, _score: score, _patternMatched: patternMatched, _hasCay: hasCay, _langKhop: langKhop };
  });

  let filtered = scored;
  if (intent !== 'general') {
    filtered = scored.filter((t) => {
      const cat = String(t.category || 'general').toLowerCase();
      return cat === intent || cat === 'general';
    });
  }

  filtered = filtered.filter((t) => t._langKhop);
  filtered.sort((a, b) => b._score - a._score);

  const passed = filtered.filter((t) => t._score >= minScore);

  logger.debug(`Kho 2: ${candidates.length} thô → ${filtered.length} sau lọc → ${passed.length} pass (≥${minScore})`);

  passed.slice(0, 3).forEach((t, i) => {
    logger.debug(`  [${i + 1}] TIP ${t._id} score=${t._score} langKhop=${t._langKhop}`);
  });

  return passed.slice(0, limit).map(({ _score, _patternMatched, _hasCay, _langKhop, ...tip }) => tip);
}

async function saveTIP(tipData) {
  if (!tipData || !tipData.nguyenLy || tipData.nguyenLy.trim() === '') throw new Error('TIP thiếu nguyenLy');

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
    cayQuyetDinhJson: tipData.cayQuyetDinhJson || null,
    usageCount: 0, successCount: 0, failCount: 0, lastUsedAt: null,
    version: 1, mergedFrom: [], isDeprecated: false, deprecatedReason: '',
  });

  logger.success(`Lưu TIP Kho 2: ${tip._id} [${tip.category}] patterns=${(tip.patterns || []).length}, rules=${tip.cayQuyetDinhJson ? (tip.cayQuyetDinhJson.rules || []).length : 0}`);
  return tip;
}

async function getTIPById(id) { return getTipModel().findById(id).lean(); }
async function countTIP() { return getTipModel().countDocuments(); }

module.exports = {
  searchTIP, saveTIP, getTIPById, countTIP,
  detectIntent, detectLangCan, extractNgrams, expandSynonyms, scoreTIP,
  tokenize, intentCanLogic, kiemNgonNguKhop,
  countKeywordHits, countTokenHits,
  GENERIC_WORDS,
};