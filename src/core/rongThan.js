/* ═══════════════════════════════════════════════════════════════
   🐉 RỒNG THẦN — Orchestrator với CÂY GỐC
   - Đọc Context + User Profile + Intent History
   - Duyệt cây gốc
   - Nếu thiếu nhánh → Não sinh nhánh con
   - [SỬA] Nếu vẫn còn issue high sau 3 lần → KHÔNG LƯU, KHÔNG CHẠY
   ═══════════════════════════════════════════════════════════════ */

const { docNguCanh, rutGonChoNao } = require('./docNguCanh');
const { webSearch } = require('./webSearch');
const { detectIntent, detectLangCan } = require('./khoTriThuc');
const rootTreeService = require('../services/rootTree.service');
const rootTreeHelper = require('./rootTreeHelper');
const naoTrai = require('./brains/naoTrai');
const naoPhai = require('./brains/naoPhai');
const tieuNao = require('./tieuNao');
const contextService = require('../services/context.service');
const userService = require('../services/user.service');
const logger = require('../utils/logger');

/* ═══════════════════════════════════════════════════════════════
   🕐 THỜI GIAN
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
  return { thu: THU_MAP[map.weekday] || map.weekday, ngay: map.day, thang: map.month, nam: map.year, gio: map.hour, phut: map.minute };
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
    logger.info('🕐 Câu hỏi thời gian → trả lời từ đồng hồ');
    return { answer: traLoiThoiGian(), source: 'system_clock', meta: { type: 'time_query' } };
  }

  const context = await docNguCanh({ conversationId, userId, guestSessionId });
  context.thoiGianHienTai = layThoiGianChoContext();

  const userProfile = userId ? await userService.getProfile(userId) : null;
  const intentHistory = context?.context?.intentHistory || [];

  const analysis = phanTichYeuCau({ problem, context, userProfile, intentHistory });
  logger.info(`🐉 Phân tích: web=${analysis.needWeb}, intent=${analysis.intent}, langCan=${analysis.langCan || 'null'}, path=[${analysis.path.join(' > ')}]`);

  capNhatContext({
    conversationId, userId, guestSessionId, context, problem, intent: analysis.intent,
  }).catch((err) => logger.warn('Context update lỗi:', err.message));

  if (userId) contextService.pushIntent(conversationId, analysis.intent).catch(() => {});
  if (userId && analysis.langCan) userService.autoLearn(userId, { lang: analysis.langCan }).catch(() => {});

  if (analysis.needWeb) return await xuLyCoWeb({ problem, searchQuery: analysis.searchQuery });

  return await xuLyCay({ problem, analysis, context, owner, userProfile, intentHistory });
}

/* ═══════════════════════════════════════════════════════════════
   XỬ LÝ CÂY GỐC
   ═══════════════════════════════════════════════════════════════ */

async function xuLyCay({ problem, analysis, context, owner, userProfile, intentHistory }) {
  const path = analysis.path || [];

  if (path.length === 0) {
    logger.info(`🌳 Không detect được nhánh → fallback Não trái`);
    return await fallbackKhongPath({ problem, context, owner, userProfile, intentHistory });
  }

  const pathIds = rootTreeHelper.pathToIds(path);
  logger.info(`🌳 Duyệt cây: [${pathIds.join(' > ')}]`);

  const duyetResult = await rootTreeService.duyetCayFull(pathIds);

  /* Đủ nhánh */
  if (duyetResult.success && duyetResult.nhanh) {
    logger.info(`✅ Tìm thấy nhánh "${duyetResult.nhanh.id}" → chạy Tiểu não`);

    const result = await tieuNao.xuLyNhanh({
      nhanh: duyetResult.nhanh,
      problem,
      userRequestType: analysis.needCode ? 'code' : 'no_code',
      owner,
      context,
    });

    if (result.meta && result.meta.matched) {
      return formatKetQua(result, duyetResult.nhanh, 'cay_goc');
    }

    if (result.type === 'need_child') {
      logger.info(`🌳 Nhánh "${duyetResult.nhanh.id}" là khung → đi xuống con`);
      return await xuLyCon({ nhanhCha: duyetResult.nhanh, problem, analysis, context, owner, userProfile, intentHistory });
    }

    return {
      answer: tieuNao.formatNhanhDayDu(duyetResult.nhanh),
      source: 'cay_goc_fallback',
      meta: { nhanhId: duyetResult.nhanh.id },
    };
  }

  /* Thiếu nhánh */
  logger.info(`🌳 Cây thiếu nhánh tại vị trí ${duyetResult.missingAt} → gọi Não sinh`);

  return await sinhNhanhCon({ problem, analysis, context, owner, userProfile, intentHistory, duyetResult, path, pathIds });
}

/* ═══════════════════════════════════════════════════════════════
   SINH NHÁNH CON
   ═══════════════════════════════════════════════════════════════ */

async function sinhNhanhCon({ problem, analysis, context, owner, userProfile, intentHistory, duyetResult, path, pathIds }) {
  const contextRutGon = rutGonChoNao({ context, problem, recentCount: 20 });

  const chaId = duyetResult.lastFoundPath;
  const chaNhanh = chaId ? await rootTreeService.layNhanh(chaId) : null;

  const missingIndex = duyetResult.missingAt;
  const conId = pathIds[missingIndex];
  const conPath = path.slice(0, missingIndex + 1);

  const meNhanh = analysis.me ? await rootTreeService.layNhanh(analysis.me) : null;

  logger.info(`🧠 Não trái sinh nhánh "${conId}" (parent=${chaId || 'root'}, cha=${chaId}, me=${analysis.me || 'null'})`);

  const MAX_ATTEMPTS = 3;
  let currentNhanh = null;
  let missingFields = [];
  let lastIssues = [];

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    let traiResult;
    try {
      if (!currentNhanh) {
        logger.info(`🧠 Não trái sinh nhánh (${attempt}/${MAX_ATTEMPTS})`);
        traiResult = await naoTrai.sinhNhanhMoi({
          id: conId,
          parent: chaId || 'root',
          cha: chaId,
          me: analysis.me || null,
          depth: conPath.length,
          problem,
          chaNhanh,
          meNhanh,
          context: contextRutGon,
          owner,
          userProfile,
          intentHistory,
        });
      } else {
        logger.info(`🧠 Não trái bổ sung [${missingFields.join(',')}] (${attempt}/${MAX_ATTEMPTS})`);
        traiResult = await naoTrai.boSungNhanh({
          nhanh: currentNhanh, missingFields, problem, owner,
          userProfile, intentHistory,
        });
      }
    } catch (err) {
      logger.error(`Não trái lỗi lần ${attempt}:`, err.message);
      continue;
    }

    currentNhanh = traiResult.nhanh;

    /* Verify */
    logger.info(`🧠 Não phải verify nhánh (${attempt}/${MAX_ATTEMPTS})`);

    let phaiResult;
    try {
      phaiResult = await naoPhai.kiemChung({
        nhanh: currentNhanh, originalProblem: problem, owner,
      });
    } catch (err) {
      logger.error(`Não phải lỗi lần ${attempt}:`, err.message);
      continue;
    }

    const evalRes = phaiResult.evaluation;
    lastIssues = evalRes.issues || [];

    /* Log issue rõ */
    if (lastIssues.length > 0) {
      lastIssues.forEach((iss) => {
        logger.warn(`   ↳ [${iss.severity}] ${iss.field}: ${iss.problem}`);
      });
    }

    if (evalRes.testsFailed) {
      logger.warn(`Tests fail → bổ sung logicValue`);
      missingFields = ['logicValue'];
      continue;
    }

    const highIssues = lastIssues.filter((i) => i.severity === 'high');
    if (highIssues.length > 0) {
      logger.warn(`⚠️ Não phải có ${highIssues.length} issue high → Não trái bổ sung`);
      let missing = [...new Set(highIssues.map((i) => i.field).filter(Boolean))];
      if (missing.length === 0) missing = ['patterns'];
      missingFields = missing;
      continue;
    }

    if (evalRes.needSupplement) {
      missingFields = [...new Set(evalRes.missingFields)];
      continue;
    }

    /* Pass */
    break;
  }

  if (!currentNhanh) {
    return {
      answer: '⚠️ Không tạo được nhánh mới. Vui lòng thử lại.',
      source: 'error',
      meta: { reason: 'sinhNhanhCon_fail' },
    };
  }

  /* ═══ [SỬA] Nếu vẫn còn issue high sau 3 lần → KHÔNG LƯU ═══ */
  const finalHighIssues = lastIssues.filter((i) => i.severity === 'high');
  const coIssue = finalHighIssues.length > 0;

  if (coIssue) {
    logger.error(`❌ Nhánh vẫn còn ${finalHighIssues.length} issue high sau 3 lần → KHÔNG LƯU`);
    finalHighIssues.forEach((iss) => {
      logger.error(`   ↳ ${iss.field}: ${iss.problem}`);
    });

    return {
      answer: '⚠️ Không tạo được nhánh mới. Vui lòng thử lại với câu hỏi khác.',
      source: 'error',
      meta: {
        reason: 'nhanh_issue_high',
        issues: finalHighIssues.map((i) => `${i.field}: ${i.problem}`),
      },
    };
  }

  /* Lưu nhánh */
  try {
    await rootTreeService.luuNhanh(currentNhanh);
    logger.success(`✅ Lưu nhánh "${currentNhanh.id}" vào cây gốc`);

    if (chaId) {
      await rootTreeService.themCon(chaId, currentNhanh.id);
    }
  } catch (err) {
    logger.error('Lưu nhánh lỗi:', err.message);
    return {
      answer: '⚠️ Không lưu được nhánh. Vui lòng thử lại.',
      source: 'error',
      meta: { error: err.message },
    };
  }

  /* Nếu còn con thiếu → đệ quy */
  if (pathIds.length > missingIndex + 1) {
    logger.info(`🌳 Còn ${pathIds.length - missingIndex - 1} nhánh con cần sinh tiếp`);
    return await xuLyCay({ problem, analysis, context, owner, userProfile, intentHistory });
  }

  /* Chạy Tiểu não */
  logger.info(`✅ Dùng nhánh mới "${currentNhanh.id}" → chạy Tiểu não`);

  const result = await tieuNao.xuLyNhanh({
    nhanh: currentNhanh,
    problem,
    userRequestType: analysis.needCode ? 'code' : 'no_code',
    owner,
    context,
  });

  if (result.meta && result.meta.matched) {
    return formatKetQua(result, currentNhanh, 'cay_goc_moi');
  }

  return {
    answer: tieuNao.formatNhanhDayDu(currentNhanh),
    source: 'cay_goc_moi_fallback',
    meta: { nhanhId: currentNhanh.id },
  };
}

/* ═══════════════════════════════════════════════════════════════
   ĐI XUỐNG CON
   ═══════════════════════════════════════════════════════════════ */

async function xuLyCon({ nhanhCha, problem, analysis, context, owner, userProfile, intentHistory }) {
  const conIds = nhanhCha.children || [];
  if (conIds.length === 0) {
    return {
      answer: `⚠️ Nhánh "${nhanhCha.id}" chưa có con. Vui lòng thử lại.`,
      source: 'error',
    };
  }

  let conChon = null;
  if (analysis.langCan) {
    for (const id of conIds) {
      if (id.includes(analysis.langCan)) { conChon = id; break; }
    }
  }
  if (!conChon) conChon = conIds[0];

  const nhanhCon = await rootTreeService.layNhanh(conChon);

  if (!nhanhCon) {
    const conPath = conChon.split('.');
    return await sinhNhanhCon({
      problem, analysis, context, owner, userProfile, intentHistory,
      duyetResult: { missingAt: conPath.length - 1, lastFoundPath: nhanhCha.id },
      path: conPath,
      pathIds: [conChon],
    });
  }

  const result = await tieuNao.xuLyNhanh({
    nhanh: nhanhCon,
    problem,
    userRequestType: analysis.needCode ? 'code' : 'no_code',
    owner,
    context,
  });

  if (result.meta && result.meta.matched) {
    return formatKetQua(result, nhanhCon, 'cay_goc_con');
  }

  if (result.type === 'need_child') {
    return await xuLyCon({ nhanhCha: nhanhCon, problem, analysis, context, owner, userProfile, intentHistory });
  }

  return {
    answer: tieuNao.formatNhanhDayDu(nhanhCon),
    source: 'cay_goc_con_fallback',
  };
}

/* ═══════════════════════════════════════════════════════════════
   FORMAT
   ═══════════════════════════════════════════════════════════════ */

function formatKetQua(result, nhanh, source) {
  return {
    answer: result.answer,
    source,
    code: result.code || null,
    language: result.language || null,
    output: result.output || null,
    meta: {
      nhanhId: nhanh?.id || null,
      category: nhanh?.category || null,
      ...result.meta,
    },
  };
}

/* ═══════════════════════════════════════════════════════════════
   FALLBACK
   ═══════════════════════════════════════════════════════════════ */

async function fallbackKhongPath({ problem, context, owner, userProfile, intentHistory }) {
  const contextRutGon = rutGonChoNao({ context, problem, recentCount: 20 });

  logger.info(`🆘 Fallback: Não trái trả lời trực tiếp`);

  try {
    const traiResult = await naoTrai.sinhNhanhMoi({
      id: 'general.' + Date.now(),
      parent: 'general',
      cha: null,
      me: null,
      depth: 2,
      problem,
      chaNhanh: null,
      meNhanh: null,
      context: contextRutGon,
      owner,
      userProfile,
      intentHistory,
    });

    const nhanh = traiResult.nhanh;
    logger.info(`✅ Não trái trả lời tạm (không lưu cây)`);

    return {
      answer: nhanh.nguyenLy || nhanh.phuongPhap || 'Đã xử lý',
      source: 'nao_trai_truc_tiep',
      code: nhanh.logicValue || null,
      language: nhanh.logicType === 'code' ? 'code' : null,
      output: null,
      meta: { tempNhanh: true, category: nhanh.category },
    };
  } catch (err) {
    logger.error('Fallback lỗi:', err.message);
    return {
      answer: `⚠️ Không xử lý được câu hỏi. Vui lòng thử lại.`,
      source: 'error',
      meta: { error: err.message },
    };
  }
}

/* ═══════════════════════════════════════════════════════════════
   CONTEXT
   ═══════════════════════════════════════════════════════════════ */

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

/* ═══════════════════════════════════════════════════════════════
   PHÂN TÍCH
   ═══════════════════════════════════════════════════════════════ */

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

function phanTichYeuCau({ problem, context, userProfile, intentHistory }) {
  let needWeb = false, webHits = 0;
  for (const re of WEB_PATTERNS) if (re.test(problem)) { needWeb = true; webHits++; }

  let needCode = false, codeHits = 0;
  for (const re of CODE_PATTERNS) if (re.test(problem)) { needCode = true; codeHits++; }

  if (needWeb && needCode && codeHits > webHits) needWeb = false;
  needCode = needCode && !needWeb;

  const intent = detectIntent(problem);
  let langCan = detectLangCan(problem);
  if (!langCan && userProfile?.preferredLang) langCan = userProfile.preferredLang;

  const path = rootTreeHelper.taoPathNhanh(problem);
  const pheps = rootTreeHelper.phatHienPhepToan(problem);

  let me = null;
  if (pheps.length >= 2) {
    me = `math.${pheps[1]}`;
  }

  return {
    needWeb, needCode, intent, langCan, path, me,
    mainProblem: problem,
    searchQuery: buildSearchQuery(problem),
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

module.exports = {
  xuLy,
  phanTichYeuCau,
  extractKeywords,
  capNhatContext,
  laCauHoiThoiGian,
  traLoiThoiGian,
};