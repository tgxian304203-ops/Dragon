/* ═══════════════════════════════════════════════════════════════
   🧠 TIỂU NÃO — Duyệt cây gốc + chạy logic
   - Bước 1: Match pattern của nhánh
   - Bước 2: Chạy cây quyết định JSON của nhánh
   - Bước 3: Nếu không match → báo Rồng Thần gọi Não sinh nhánh
   ═══════════════════════════════════════════════════════════════ */

const {
  matchPattern, runLogic, formatOutput, detectLangFromCode,
  chayCayQuyetDinh,
} = require('./logicRunner');
const rootTreeService = require('../services/rootTree.service');
const logger = require('../utils/logger');

/* ═══════════════════════════════════════════════════════════════
   DETECT NGÔN NGỮ
   ═══════════════════════════════════════════════════════════════ */

function detectLangCan(problem) {
  const q = String(problem).toLowerCase();
  if (/html|web|shop|trang|landing|spck|css|giao diện|ui\b/.test(q)) return 'html';
  if (/python|py\b/.test(q)) return 'python';
  if (/javascript|js\b|node|express/.test(q)) return 'javascript';
  if (/java\b/.test(q)) return 'java';
  if (/c\+\+|cpp/.test(q)) return 'cpp';
  if (/go\b|golang/.test(q)) return 'go';
  if (/rust/.test(q)) return 'rust';
  if (/react native/.test(q)) return 'react-native';
  if (/flutter/.test(q)) return 'flutter';
  return null;
}

function kiemNgonNguKhop(nhanh, langCan) {
  if (!langCan) return true;
  if (!nhanh.logicValue) return true;

  const nhanhLang = detectLangFromCode(nhanh.logicValue);
  const alias = {
    'html': ['html', 'css'],
    'python': ['python'],
    'javascript': ['javascript'],
    'java': ['java'],
    'cpp': ['cpp'],
    'go': ['go'],
    'rust': ['rust'],
  };
  const accepted = alias[langCan] || [langCan];
  return accepted.includes(nhanhLang);
}

/* ═══════════════════════════════════════════════════════════════
   MAIN — XỬ LÝ 1 NHÁNH
   ═══════════════════════════════════════════════════════════════ */

async function xuLyNhanh({ nhanh, problem, userRequestType, owner, context = null }) {
  if (!nhanh || !nhanh.id) throw new Error('Nhánh không hợp lệ');
  if (!problem || problem.trim() === '') throw new Error('Vấn đề rỗng');

  logger.info(`🧠 Tiểu não [${userRequestType}] nhánh "${nhanh.id}": "${problem.slice(0, 60)}..."`);

  const nhanhId = nhanh.id;
  const langCan = detectLangCan(problem);
  const langKhop = kiemNgonNguKhop(nhanh, langCan);

  if (!langKhop) {
    logger.warn(`⚠️ Nhánh ${nhanhId} SAI ngôn ngữ (nhánh=${detectLangFromCode(nhanh.logicValue)}, cần=${langCan})`);
  }

  /* ═══ BƯỚC 1: Match pattern ═══ */
  const hasPatterns = Array.isArray(nhanh.patterns) && nhanh.patterns.length > 0;

  if (hasPatterns && nhanh.logicType && langKhop) {
    const vars = matchPattern(nhanh.patterns, problem);

    if (vars) {
      logger.info(`🎯 Match pattern — vars=${JSON.stringify(vars)}`);

      rootTreeService.tangUsage(nhanhId, 'usage').catch(() => {});

      const result = await runLogic({
        logicType: nhanh.logicType,
        logicValue: nhanh.logicValue,
        vars,
      });

      if (result.success) {
        const answer = formatOutput(nhanh.outputTpl, vars, result.kq);
        logger.success(`✅ Tiểu não tự tính: ${String(answer).slice(0, 80)}`);

        rootTreeService.tangUsage(nhanhId, 'success').catch(() => {});

        if (result.isCode || result.isPatch) {
          return {
            answer,
            type: result.isCode ? 'code' : 'patch',
            code: result.kq,
            language: result.language || detectLangFromCode(result.kq),
            output: result.output || '',
            meta: { nhanhId, matched: true, vars, logicType: nhanh.logicType, ran: true },
          };
        }

        return {
          answer,
          type: 'no_code',
          code: null, language: null, output: null,
          meta: { nhanhId, matched: true, vars, logicType: nhanh.logicType },
        };
      }

      logger.warn(`Match pattern nhưng chạy logic lỗi: ${result.error}`);
      rootTreeService.tangUsage(nhanhId, 'fail').catch(() => {});

      if (result.isCode || result.isPatch) {
        return {
          answer: `⚠️ Code chạy lỗi: ${result.error}`,
          type: result.isCode ? 'code' : 'patch',
          code: result.kq,
          language: result.language || detectLangFromCode(result.kq),
          output: result.output || '',
          meta: { nhanhId, matched: true, vars, logicType: nhanh.logicType, ran: false, error: result.error },
        };
      }
    } else {
      logger.debug(`Không match pattern nào của nhánh ${nhanhId}`);
    }
  }

  /* ═══ BƯỚC 2: Chạy cây quyết định JSON ═══ */
  if (nhanh.cayQuyetDinhJson && Array.isArray(nhanh.cayQuyetDinhJson.rules) && nhanh.cayQuyetDinhJson.rules.length > 0 && langKhop) {
    logger.info(`🌳 Thử chạy cây quyết định (${nhanh.cayQuyetDinhJson.rules.length} rules)`);

    try {
      const cayResult = await chayCayQuyetDinh({ nhanh, problem });

      if (cayResult.success) {
        logger.success(`✅ Cây quyết định xử lý được: ${String(cayResult.kq).slice(0, 80)}`);

        rootTreeService.tangUsage(nhanhId, 'usage').catch(() => {});
        rootTreeService.tangUsage(nhanhId, 'success').catch(() => {});

        if (cayResult.isCode || cayResult.isPatch || cayResult.language) {
          return {
            answer: cayResult.formatted || String(cayResult.kq),
            type: cayResult.isPatch ? 'patch' : 'code',
            code: cayResult.kq,
            language: cayResult.language || detectLangFromCode(cayResult.kq),
            output: cayResult.output || '',
            meta: { nhanhId, matched: 'cayQuyetDinh', vars: cayResult.vars, ran: true },
          };
        }

        return {
          answer: cayResult.formatted || String(cayResult.kq),
          type: 'no_code',
          code: null, language: null, output: null,
          meta: { nhanhId, matched: 'cayQuyetDinh', vars: cayResult.vars },
        };
      }

      logger.debug(`Cây không xử lý được: ${cayResult.error}`);
    } catch (err) {
      logger.warn(`Chạy cây lỗi: ${err.message}`);
    }
  }

  /* ═══ BƯỚC 3: Nhánh khung → cần đi xuống con ═══ */
  return {
    answer: null,
    type: 'need_child',
    code: null, language: null, output: null,
    meta: { nhanhId, matched: false, needChild: true, nhanh },
  };
}

/* ═══════════════════════════════════════════════════════════════
   FALLBACK
   ═══════════════════════════════════════════════════════════════ */

function formatNhanhDayDu(nhanh) {
  if (!nhanh) return '(không có nhánh)';
  const parts = [];
  parts.push(`📌 **Nguyên lý:**\n${nhanh.nguyenLy || '(chưa có)'}`);
  if (nhanh.quyTac) parts.push(`\n📏 **Quy tắc:**\n${nhanh.quyTac}`);
  if (nhanh.dieuKien) parts.push(`\n🔗 **Điều kiện:**\n${nhanh.dieuKien}`);
  if (nhanh.cayQuyetDinh) parts.push(`\n🌳 **Cây quyết định:**\n${nhanh.cayQuyetDinh}`);
  if (nhanh.phuongPhap) parts.push(`\n🛠️ **Phương pháp:**\n${nhanh.phuongPhap}`);
  if (nhanh.thuatToan) parts.push(`\n⚙️ **Thuật toán:**\n${nhanh.thuatToan}`);
  if (nhanh.workflow) parts.push(`\n🔄 **Workflow:**\n${nhanh.workflow}`);
  if (nhanh.suyLuan) parts.push(`\n🧠 **Suy luận:**\n${nhanh.suyLuan}`);
  if (nhanh.testCase) parts.push(`\n🧪 **Test case:**\n${nhanh.testCase}`);
  if (nhanh.kiemChung) parts.push(`\n🔍 **Kiểm chứng:**\n${nhanh.kiemChung}`);
  if (nhanh.ngoaiLe) parts.push(`\n⚠️ **Ngoại lệ:**\n${nhanh.ngoaiLe}`);
  if (nhanh.caseKinhNghiem) parts.push(`\n💡 **Case:**\n${nhanh.caseKinhNghiem}`);
  if (nhanh.nguonPhienBan) parts.push(`\n📚 **Nguồn:** ${nhanh.nguonPhienBan}`);
  return parts.join('\n');
}

module.exports = { xuLyNhanh, formatNhanhDayDu, detectLangCan, kiemNgonNguKhop };