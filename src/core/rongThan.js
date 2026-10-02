/* ═══════════════════════════════════════════════════════════════
   🐉 RỒNG THẦN — Orchestrator (R1–R8)
   ═══════════════════════════════════════════════════════════════ */

const { docNguCanh, rutGonChoNao } = require('./docNguCanh');
const { webSearch } = require('./webSearch');
const { searchTIP, saveTIP, detectIntent } = require('./khoTriThuc');
const naoTrai = require('./brains/naoTrai');
const naoPhai = require('./brains/naoPhai');
const tieuNao = require('./tieuNao');
const { danhGiaTIP } = require('./danhGiaTIP');
const contextService = require('../services/context.service');
const logger = require('../utils/logger');

async function xuLy({ message, conversationId, userId, guestSessionId }) {
  if (!message || message.trim() === '') throw new Error('Tin nhắn rỗng');
  if (!conversationId) throw new Error('Thiếu conversationId');

  const owner = { userId, guestSessionId };
  const problem = message.trim();

  logger.info(`🐉 Rồng Thần: "${problem.slice(0, 80)}..."`);

  const context = await docNguCanh({ conversationId, userId, guestSessionId });

  const analysis = phanTichYeuCau({ problem, context });
  logger.info(`🐉 Phân tích: web=${analysis.needWeb}, code=${analysis.needCode}, intent=${analysis.intent}`);

  capNhatContext({ conversationId, userId, guestSessionId, context, problem, intent: analysis.intent })
    .catch((err) => logger.warn('Context update lỗi:', err.message));

  if (analysis.needWeb) return await xuLyCoWeb({ problem, searchQuery: analysis.searchQuery });

  return await xuLyKhongWeb({ problem, analysis, context, owner });
}

async function capNhatContext({ conversationId, userId, guestSessionId, context, problem, intent = 'general' }) {
  if (!context || !context.allMessages || context.allMessages.length === 0) return;

  const oldCtx = context.context || {};

  const allText = context.allMessages.map((m) => m.text || '').join(' ');
  const keywords = extractKeywords(allText).slice(0, 30);

  const firstMsg = context.allMessages[0]?.text || '';
  const nguyenLy = oldCtx.nguyenLy || `Bắt đầu: ${firstMsg.slice(0, 200)}\nGần đây: ${problem.slice(0, 200)}`;

  await contextService.saveContext({
    conversationId,
    userId,
    guestSessionId,
    nguyenLy,
    quyTac: oldCtx.quyTac || '',
    dieuKien: oldCtx.dieuKien || '',
    cayQuyetDinh: oldCtx.cayQuyetDinh || '',
    phuongPhap: oldCtx.phuongPhap || '',
    thuatToan: oldCtx.thuatToan || '',
    workflow: oldCtx.workflow || '',
    suyLuan: oldCtx.suyLuan || '',
    testCase: oldCtx.testCase || '',
    kiemChung: oldCtx.kiemChung || '',
    ngoaiLe: oldCtx.ngoaiLe || '',
    caseKinhNghiem: oldCtx.caseKinhNghiem || '',
    quanHe: oldCtx.quanHe || [],
    nguonPhienBan: oldCtx.nguonPhienBan || '',
    category: intent,
    keywords,
  });
}

const WEB_PATTERNS = [
  /\b(hôm nay|hôm qua|ngày mai|tuần này|tháng này|năm nay|mới nhất|gần đây|hiện tại|bây giờ)\b/i,
  /\b(tin tức|thời sự|sự kiện|báo|news|thời tiết|dự báo|giá cả|giá vàng|chứng khoán|tỷ giá)\b/i,
  /\b(tìm kiếm|tra cứu|search|google|tìm giúp|tra giúp|xem giúp)\b/i,
  /\b(tại đâu|khi nào|ai là|thông tin về)\b/i,
  /https?:\/\//i,
];

const CODE_PATTERNS = [
  /\b(code|viết code|viết hàm|lập trình|script|đoạn code|chương trình)\b/i,
  /\b(python|javascript|js|typescript|java|c\+\+|c#|ruby|go|rust|php|html|css|sql)\b/i,
  /\b(function|class|loop|array|object|api|thuật toán|algorithm)\b/i,
  /\b(sửa code|fix bug|lỗi code|debug|tối ưu code)\b/i,
  /\b(tính toán|tính giúp|giải phương trình|tính giá trị)\b/i,
  /\b(viết|tạo|xây dựng)\b.*\b(web|app|game|tool|công cụ|trang)\b/i,
];

function phanTichYeuCau({ problem, context }) {
  const ruleResult = phanTichBangRule(problem);
  const contextResult = phanTichBangContext({ problem, context });
  return ketHopPhanTich({ problem, ruleResult, contextResult });
}

function phanTichBangRule(problem) {
  let needWeb = false, webHits = 0;
  for (const re of WEB_PATTERNS) if (re.test(problem)) { needWeb = true; webHits++; }

  let needCode = false, codeHits = 0;
  for (const re of CODE_PATTERNS) if (re.test(problem)) { needCode = true; codeHits++; }

  if (needWeb && needCode && codeHits > webHits) needWeb = false;

  // Intent detection
  const intent = detectIntent(problem);

  return {
    needWeb,
    needCode: needCode && !needWeb,
    webHits, codeHits,
    intent,
    searchQuery: buildSearchQuery(problem),
  };
}

function phanTichBangContext({ problem, context }) {
  const result = { inCodeFlow: false, inWebFlow: false };
  if (!context || !context.context) return result;

  const ctx = context.context;
  const codeKeywords = ['code', 'python', 'javascript', 'lập trình', 'hàm', 'function', 'thuật toán'];
  const webKeywords = ['tin tức', 'thời sự', 'tra cứu', 'thời tiết', 'giá'];

  const ctxText = [ctx.nguyenLy, ctx.phuongPhap, ctx.suyLuan].filter(Boolean).join(' ').toLowerCase();
  if (codeKeywords.some((k) => ctxText.includes(k))) result.inCodeFlow = true;
  if (webKeywords.some((k) => ctxText.includes(k))) result.inWebFlow = true;

  const recent = (context.allMessages || []).slice(-20);
  const recentUserTexts = recent
    .filter((m) => m.role === 'user')
    .map((m) => (m.text || '').toLowerCase())
    .join(' ');

  if (codeKeywords.some((k) => recentUserTexts.includes(k))) result.inCodeFlow = true;
  if (webKeywords.some((k) => recentUserTexts.includes(k))) result.inWebFlow = true;

  return result;
}

function ketHopPhanTich({ problem, ruleResult, contextResult }) {
  let needWeb = ruleResult.needWeb;
  let needCode = ruleResult.needCode;

  if (!needWeb && !needCode && contextResult.inCodeFlow) {
    if (/\b(làm|tạo|viết|sửa|thêm|xóa|đổi|tính|giải)\b/i.test(problem)) needCode = true;
  }

  return {
    needWeb,
    needCode,
    intent: ruleResult.intent,
    mainProblem: problem,
    searchQuery: ruleResult.searchQuery,
  };
}

function buildSearchQuery(problem) {
  return problem
    .replace(/\b(ơi|à|ạ|nhé|nha|giúp|giùm|với|thì|mà|là|cho|tôi|mình|em|anh|chị)\b/gi, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 200);
}

function extractKeywords(text) {
  const stopWords = new Set([
    'là', 'của', 'và', 'có', 'không', 'được', 'cho', 'với', 'thì', 'mà',
    'này', 'kia', 'đó', 'tôi', 'mình', 'bạn', 'em', 'anh', 'chị',
    'gì', 'sao', 'nào', 'đâu', 'khi', 'thế', 'ạ', 'à', 'nhé', 'nha',
    'the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'to', 'of', 'in',
  ]);

  const words = (text || '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .split(/\s+/)
    .filter((w) => w.length >= 3 && !stopWords.has(w));

  const freq = {};
  for (const w of words) freq[w] = (freq[w] || 0) + 1;

  return Object.entries(freq).sort((a, b) => b[1] - a[1]).map(([w]) => w);
}

async function xuLyCoWeb({ problem, searchQuery }) {
  logger.info(`🌐 DDG: "${searchQuery.slice(0, 60)}..."`);

  try {
    const searchResult = await webSearch(searchQuery);
    return {
      answer: formatWebOutput(searchResult, problem),
      source: 'web',
      meta: { searchQuery, resultCount: searchResult.results.length },
    };
  } catch (err) {
    logger.error('Web search lỗi:', err.message);
    return {
      answer: `⚠️ Lỗi tìm kiếm: ${err.message}`,
      source: 'web_error',
      meta: { error: err.message },
    };
  }
}

function formatWebOutput(searchResult, problem) {
  if (!searchResult || !searchResult.results || searchResult.results.length === 0) {
    return `🔍 Không tìm thấy: "${searchResult?.query || problem}"`;
  }
  const lines = [`🔍 Kết quả cho: "${searchResult.query}"\n`];
  searchResult.results.forEach((r, i) => {
    lines.push(`${i + 1}. **${r.title}**`);
    if (r.snippet) lines.push(`   ${r.snippet}`);
    lines.push(`   🔗 ${r.url}`, '');
  });
  return lines.join('\n');
}

async function xuLyKhongWeb({ problem, analysis, context, owner }) {
  const searchQuery = analysis.mainProblem || problem;
  const needCode = analysis.needCode;
  const intent = analysis.intent;

  const MAX_OUTER_LOOPS = 2;

  for (let outer = 0; outer < MAX_OUTER_LOOPS; outer++) {
    let relatedTIPs = [];
    try {
      relatedTIPs = await searchTIP(searchQuery, {
        limit: 10,
        minScore: 20,
        intent,
      });
    } catch (err) {
      logger.warn('Search Kho 2 lỗi:', err.message);
    }

    // Search đã scoring + lọc ngưỡng → TIP đầu tiên là tốt nhất
    let tip = null;
    for (const t of relatedTIPs) {
      if (isTIPPhuHop(t, needCode)) {
        tip = t;
        break;
      }
    }

    if (tip) {
      logger.info(`📚 Kho 2 có TIP phù hợp [${tip.category}] → dùng`);
      return await chayTieuNao({ tip, problem, needCode, owner, context, source: 'kho2' });
    }

    if (outer === 0) {
      logger.info(`📚 Không có TIP phù hợp → Não trái + Não phải`);

      const newTip = await taoTIPMoi({ problem, context, owner, needCode, relatedTIPs, intent });

      if (!newTip) {
        return {
          answer: '⚠️ Không tạo được TIP. Vui lòng thử lại hoặc thêm key.',
          source: 'error',
          meta: { reason: 'taoTIPMoi_fail' },
        };
      }

      logger.info(`✅ Đã lưu TIP [${newTip.category}] → quay lại search Kho 2`);
      continue;
    }

    logger.warn(`Quay lại vẫn không tìm thấy → Não trái + Não phải trực tiếp`);

    return {
      answer: '⚠️ Không có TIP khả dụng. Vui lòng thử lại.',
      source: 'error',
      meta: { reason: 'no_tip' },
    };
  }

  return {
    answer: '⚠️ Lỗi vòng lặp.',
    source: 'error',
    meta: { reason: 'loop_error' },
  };
}

async function chayTieuNao({ tip, problem, needCode, owner, context, source }) {
  const userRequestType = needCode ? 'code' : 'no_code';

  try {
    const result = await tieuNao.xuLy({
      tip, problem, userRequestType, owner, context,
    });

    return {
      answer: result.answer,
      source,
      code: result.code || null,
      language: result.language || null,
      output: result.output || null,
      meta: { userRequestType, tipId: tip._id?.toString(), category: tip.category, ...result.meta },
    };
  } catch (err) {
    logger.error('Tiểu não lỗi:', err.message);
    return {
      answer: `⚠️ Tiểu não lỗi: ${err.message}`,
      source: 'tieuNao_error',
      meta: { error: err.message },
    };
  }
}

function isTIPPhuHop(tip, needCode) {
  if (!tip || !tip.nguyenLy || tip.nguyenLy.trim() === '') return false;
  if (needCode && !tieuNao.tipCoCode(tip)) return false;
  return true;
}

async function taoTIPMoi({ problem, context, owner, needCode, relatedTIPs = [], intent = 'general' }) {
  const contextRutGon = rutGonChoNao({ context, problem, recentCount: 20 });

  const problemForNao = needCode
    ? `${problem}\n\n⚠️ User cần CODE. TIP phải có code block (\`\`\`python ... \`\`\`) trong workflow hoặc thuatToan.`
    : problem;

  const MAX_ATTEMPTS = 3;
  let currentTip = null;
  let missingFields = [];
  let naoTraiLoi = false;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    let traiResult;
    try {
      if (!currentTip) {
        logger.info(`🧠 Não trái tạo TIP (${attempt}/${MAX_ATTEMPTS}) intent=${intent}`);
        traiResult = await naoTrai.phanTich({
          problem: problemForNao,
          context: contextRutGon,
          relatedTIPs,
          webResults: '',
          owner,
        });
      } else {
        logger.info(`🧠 Não trái bổ sung [${missingFields.join(',')}] (${attempt}/${MAX_ATTEMPTS})`);
        traiResult = await naoTrai.boSung({
          tip: currentTip, missingFields,
          problem: problemForNao, needCode, owner,
        });
      }
    } catch (err) {
      logger.error(`Não trái lỗi lần ${attempt}:`, err.message);
      naoTraiLoi = true;
      continue;
    }

    currentTip = traiResult.tip;

    const danhGia = danhGiaTIP(currentTip);
    if (!danhGia.day) {
      let missing = [...danhGia.missing, ...danhGia.empty];
      if (needCode && !tieuNao.tipCoCode(currentTip)) missing.push('workflow');
      missingFields = [...new Set(missing)];
      continue;
    }

    if (needCode && !tieuNao.tipCoCode(currentTip)) {
      missingFields = ['workflow'];
      continue;
    }

    logger.info(`🧠 Não phải kiểm (${attempt}/${MAX_ATTEMPTS})`);

    let phaiResult;
    try {
      phaiResult = await naoPhai.kiemChung({
        tip: currentTip, originalProblem: problem, owner,
      });
    } catch (err) {
      logger.error(`Não phải lỗi lần ${attempt}:`, err.message);
      continue;
    }

    if (phaiResult.evaluation.needSupplement) {
      let missing = [...phaiResult.evaluation.missingFields];
      if (needCode && !tieuNao.tipCoCode(currentTip)) missing.push('workflow');
      missingFields = [...new Set(missing)];
      continue;
    }

    break;
  }

  if (!currentTip) {
    logger.warn(naoTraiLoi ? 'Não trái lỗi toàn bộ 3 lần' : 'Không có TIP sau 3 lần');
    return null;
  }

  try {
    const saved = await saveTIP({
      ...currentTip,
      keywords: currentTip.keywords || [],
      category: currentTip.category || intent,
    });
    logger.success(`✅ Lưu TIP Kho 2: ${saved._id} [${saved.category}]`);
    return saved;
  } catch (err) {
    logger.error('Lưu TIP lỗi:', err.message);
    return { ...currentTip, _id: null, _tempOnly: true };
  }
}

module.exports = {
  xuLy,
  phanTichYeuCau,
  phanTichBangRule,
  phanTichBangContext,
  ketHopPhanTich,
  extractKeywords,
  isTIPPhuHop,
  capNhatContext,
};