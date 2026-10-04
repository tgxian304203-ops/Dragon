/* ═══════════════════════════════════════════════════════════════
   🐉 RỒNG THẦN — Orchestrator
   - Check thời gian → trả lời từ đồng hồ
   - Não trái + Não phải loop ≤3
   - [SỬA] Check issues severity high → loop bổ sung
   ═══════════════════════════════════════════════════════════════ */

const { docNguCanh, rutGonChoNao } = require('./docNguCanh');
const { webSearch } = require('./webSearch');
const { searchTIP, saveTIP, detectIntent } = require('./khoTriThuc');
const naoTrai = require('./brains/naoTrai');
const naoPhai = require('./brains/naoPhai');
const tieuNao = require('./tieuNao');
const { danhGiaTIP } = require('./danhGiaTIP');
const contextService = require('../services/context.service');
const { getTipModel } = require('../models/tip.model');
const logger = require('../utils/logger');

/* ═══════════════════════════════════════════════════════════════
   🕐 THỜI GIAN THỰC
   ═══════════════════════════════════════════════════════════════ */

const TZ_VN = 'Asia/Ho_Chi_Minh';
const THU_MAP = { Sun: 'Chủ nhật', Mon: 'Thứ hai', Tue: 'Thứ ba', Wed: 'Thứ tư', Thu: 'Thứ năm', Fri: 'Thứ sáu', Sat: 'Thứ bảy' };

const TIME_PATTERNS = [
  /hôm nay\s+(là\s+)?(thứ mấy|ngày\s+(bao nhiêu|mấy|gì)|ngày mấy)/i,
  /bây giờ\s+(là\s+)?(mấy giờ|thứ mấy|ngày mấy|ngày bao nhiêu)/i,
  /(thứ mấy|ngày mấy|ngày bao nhiêu|mấy giờ)\s*(rồi|vậy|hôm nay|bây giờ)?/i,
  /hôm nay\s+ngày\s+bao\s+nhiêu/i,
  /cho\s+(tôi|mình|em|anh|chị)\s+biết\s+(hôm nay|bây giờ)/i,
  /(hôm nay|bây giờ)\s+(là\s+)?ngày\s+gì/i,
];

function laCauHoiThoiGian(problem) {
  if (typeof problem !== 'string') return false;
  return TIME_PATTERNS.some((re) => re.test(problem));
}

function layThoiGianVN() {
  const now = new Date();
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: TZ_VN, weekday: 'short', day: '2-digit', month: '2-digit',
    year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false,
  }).formatToParts(now);
  const map = {};
  for (const p of parts) map[p.type] = p.value;
  return {
    thu: THU_MAP[map.weekday] || map.weekday,
    ngay: map.day, thang: map.month, nam: map.year,
    gio: map.hour, phut: map.minute,
  };
}

function traLoiThoiGian() {
  const t = layThoiGianVN();
  return `🕐 **Hôm nay là ${t.thu}, ngày ${t.ngay}/${t.thang}/${t.nam}**\nBây giờ là **${t.gio}:${t.phut}** (giờ Việt Nam)`;
}

function layThoiGianChoContext() {
  const t = layThoiGianVN();
  return `Thời gian hiện tại (giờ Việt Nam): ${t.thu}, ${t.ngay}/${t.thang}/${t.nam} ${t.gio}:${t.phut}`;
}

/* ═══════════════════════════════════════════════════════════════
   🐉 HÀM CHÍNH
   ═══════════════════════════════════════════════════════════════ */

async function xuLy({ message, conversationId, userId, guestSessionId }) {
  if (!message || message.trim() === '') throw new Error('Tin nhắn rỗng');
  if (!conversationId) throw new Error('Thiếu conversationId');

  const owner = { userId, guestSessionId };
  const problem = message.trim();

  logger.info(`🐉 Rồng Thần: "${problem.slice(0, 80)}..."`);

  if (laCauHoiThoiGian(problem)) {
    logger.info('🕐 Câu hỏi thời gian → trả lời từ đồng hồ hệ thống');
    return { answer: traLoiThoiGian(), source: 'system_clock', meta: { type: 'time_query' } };
  }

  const context = await docNguCanh({ conversationId, userId, guestSessionId });
  context.thoiGianHienTai = layThoiGianChoContext();

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
    conversationId, userId, guestSessionId, nguyenLy,
    quyTac: oldCtx.quyTac || '', dieuKien: oldCtx.dieuKien || '',
    cayQuyetDinh: oldCtx.cayQuyetDinh || '', phuongPhap: oldCtx.phuongPhap || '',
    thuatToan: oldCtx.thuatToan || '', workflow: oldCtx.workflow || '',
    suyLuan: oldCtx.suyLuan || '', testCase: oldCtx.testCase || '',
    kiemChung: oldCtx.kiemChung || '', ngoaiLe: oldCtx.ngoaiLe || '',
    caseKinhNghiem: oldCtx.caseKinhNghiem || '', quanHe: oldCtx.quanHe || [],
    nguonPhienBan: oldCtx.nguonPhienBan || '',
    category: intent, keywords,
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
  const intent = detectIntent(problem);

  return { needWeb, needCode: needCode && !needWeb, webHits, codeHits, intent, searchQuery: buildSearchQuery(problem) };
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
  const recentUserTexts = recent.filter((m) => m.role === 'user').map((m) => (m.text || '').toLowerCase()).join(' ');
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
    needWeb, needCode,
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
  const stopWords = new Set(['là', 'của', 'và', 'có', 'không', 'được', 'cho', 'với', 'thì', 'mà', 'này', 'kia', 'đó', 'tôi', 'mình', 'bạn', 'em', 'anh', 'chị', 'gì', 'sao', 'nào', 'đâu', 'khi', 'thế', 'ạ', 'à', 'nhé', 'nha', 'the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'to', 'of', 'in']);
  const words = (text || '').toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, ' ').split(/\s+/).filter((w) => w.length >= 3 && !stopWords.has(w));
  const freq = {};
  for (const w of words) freq[w] = (freq[w] || 0) + 1;
  return Object.entries(freq).sort((a, b) => b[1] - a[1]).map(([w]) => w);
}

async function xuLyCoWeb({ problem, searchQuery }) {
  logger.info(`🌐 Tavily: "${searchQuery.slice(0, 60)}..."`);
  try {
    const searchResult = await webSearch(searchQuery);
    return {
      answer: formatWebOutput(searchResult, problem),
      source: 'web',
      meta: { searchQuery, resultCount: searchResult.results.length },
    };
  } catch (err) {
    logger.error('Web search lỗi:', err.message);
    return { answer: `⚠️ Lỗi tìm kiếm: ${err.message}`, source: 'web_error', meta: { error: err.message } };
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

  let relatedTIPs = [];
  try {
    relatedTIPs = await searchTIP(searchQuery, { limit: 10, minScore: 15, intent });
  } catch (err) {
    logger.warn('Search Kho 2 lỗi:', err.message);
  }

  let tip = null;
  for (const t of relatedTIPs) {
    if (isTIPPhuHop(t, needCode)) { tip = t; break; }
  }

  if (tip) {
    logger.info(`📚 Kho 2 có TIP [${tip.category}] → chạy Tiểu não`);
    const result = await chayTieuNao({ tip, problem, needCode, owner, context, source: 'kho2' });

    if (result.meta && result.meta.matched === false) {
      logger.info(`🌳 Tiểu não fallback → Não trái bổ sung cây vào TIP cũ`);
      return await boSungCayVaoTIPCu({ tipCu: tip, problem, context, owner, needCode, intent, source: 'kho2_extended' });
    }

    return result;
  }

  logger.info(`📚 Không có TIP phù hợp → Não trái + Não phải`);
  const newTip = await taoTIPMoi({ problem, context, owner, needCode, relatedTIPs, intent });

  if (!newTip) {
    return { answer: '⚠️ Không tạo được TIP. Vui lòng thử lại hoặc thêm key.', source: 'error', meta: { reason: 'taoTIPMoi_fail' } };
  }

  logger.info(`✅ Dùng TIP mới [${newTip.category}] → chạy Tiểu não`);
  return await chayTieuNao({ tip: newTip, problem, needCode, owner, context, source: 'kho2_new' });
}

async function chayTieuNao({ tip, problem, needCode, owner, context, source }) {
  const userRequestType = needCode ? 'code' : 'no_code';
  try {
    const result = await tieuNao.xuLy({ tip, problem, userRequestType, owner, context });
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
    return { answer: `⚠️ Tiểu não lỗi: ${err.message}`, source: 'tieuNao_error', meta: { error: err.message } };
  }
}

async function boSungCayVaoTIPCu({ tipCu, problem, context, owner, needCode, intent, source }) {
  if (!tipCu._id) {
    logger.warn('TIP cũ không có _id → không bổ sung được');
    return { answer: '⚠️ Không mở rộng được TIP. Vui lòng thử lại.', source: 'error', meta: { reason: 'no_tip_id' } };
  }

  let traiResult;
  try {
    traiResult = await naoTrai.boSungCay({ tipCu, problem, owner });
  } catch (err) {
    logger.error(`Não trái bổ sung cây lỗi: ${err.message}`);
    return { answer: '⚠️ Không mở rộng được TIP. Vui lòng thử lại.', source: 'error', meta: { error: err.message } };
  }

  const tipMoi = traiResult.tip;

  try {
    const Tip = getTipModel();
    await Tip.updateOne(
      { _id: tipCu._id },
      {
        $set: {
          cayQuyetDinhJson: tipMoi.cayQuyetDinhJson,
          patterns: tipMoi.patterns,
          logicType: tipMoi.logicType,
          logicValue: tipMoi.logicValue,
          outputTpl: tipMoi.outputTpl,
          cayQuyetDinh: tipMoi.cayQuyetDinh,
        },
        $inc: { version: 1 },
      }
    );
    logger.success(`✅ Đã bổ sung cây vào TIP cũ ${tipCu._id} — rules=${tipMoi.cayQuyetDinhJson?.rules?.length || 0}`);

    const tipUpdated = await Tip.findById(tipCu._id).lean();
    return await chayTieuNao({ tip: tipUpdated, problem, needCode, owner, context, source });
  } catch (err) {
    logger.error('Cập nhật TIP lỗi:', err.message);
    return { answer: '⚠️ Không cập nhật được TIP.', source: 'error', meta: { error: err.message } };
  }
}

function isTIPPhuHop(tip, needCode) {
  if (!tip || !tip.nguyenLy || tip.nguyenLy.trim() === '') return false;
  if (needCode) {
    if (!['code', 'patch'].includes(tip.logicType)) return false;
    if (!Array.isArray(tip.patterns) || tip.patterns.length === 0) return false;
  }
  return true;
}

/* ═══════════════════════════════════════════════════════════════
   TẠO TIP MỚI — LOOP 3 LẦN
   [SỬA] Check issues severity high → loop bổ sung
   ═══════════════════════════════════════════════════════════════ */

async function taoTIPMoi({ problem, context, owner, needCode, relatedTIPs = [], intent = 'general' }) {
  const contextRutGon = rutGonChoNao({ context, problem, recentCount: 20 });

  const problemForNao = needCode
    ? `${problem}\n\n⚠️ User cần CODE. logicType="code", logicValue là code chạy được.`
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
          problem: problemForNao, context: contextRutGon,
          relatedTIPs, webResults: '', owner,
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
      if (!currentTip.patterns || currentTip.patterns.length === 0) missing.push('patterns');
      if (!currentTip.logicType) missing.push('logicType');
      if (!currentTip.outputTpl) missing.push('outputTpl');
      missingFields = [...new Set(missing)];
      continue;
    }

    const machineCheck = checkMachineFields(currentTip);
    if (!machineCheck.ok) {
      logger.warn(`4 trường máy chưa đủ: ${machineCheck.reason}`);
      missingFields = machineCheck.missing;
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

    const evalRes = phaiResult.evaluation;

    /* [SỬA] Check issues severity high trước tiên */
    const highIssues = (evalRes.issues || []).filter((i) => i.severity === 'high');
    if (highIssues.length > 0) {
      logger.warn(`⚠️ Não phải có ${highIssues.length} issue high → Não trái bổ sung`);
      let missing = [...new Set(highIssues.map((i) => i.field).filter(Boolean))];
      // Đảm bảo có ít nhất 1 trường để bổ sung
      if (missing.length === 0) missing = ['patterns'];
      missingFields = missing;
      continue;
    }

    if (evalRes.testsFailed) {
      logger.warn(`Tests fail → Não trái bổ sung logicValue`);
      missingFields = ['logicValue'];
      continue;
    }

    if (evalRes.needSupplement) {
      let missing = [...evalRes.missingFields];
      if (!currentTip.patterns || currentTip.patterns.length === 0) missing.push('patterns');
      if (!currentTip.logicType) missing.push('logicType');
      if (!currentTip.outputTpl) missing.push('outputTpl');
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

function checkMachineFields(tip) {
  const missing = [];
  if (!Array.isArray(tip.patterns) || tip.patterns.length === 0) missing.push('patterns');
  if (!tip.logicType) missing.push('logicType');
  if (!tip.outputTpl) missing.push('outputTpl');
  if (tip.logicType && !tip.logicValue) missing.push('logicValue');
  if (missing.length > 0) return { ok: false, missing, reason: `Thiếu: ${missing.join(', ')}` };
  return { ok: true, missing: [] };
}

module.exports = {
  xuLy, phanTichYeuCau, phanTichBangRule, phanTichBangContext,
  ketHopPhanTich, extractKeywords, isTIPPhuHop, capNhatContext,
  checkMachineFields, boSungCayVaoTIPCu,
};