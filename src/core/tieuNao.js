/* ═══════════════════════════════════════════════════════════════
   🧠 TIỂU NÃO — Match pattern → chạy logic → cây quyết định
   - Nhánh A: expr (mathjs)
   - Nhánh B: code (Judge0)
   - Nhánh C: patch (Judge0)
   - Nhánh D: cây quyết định JSON (tư duy)
   - Nhánh E: fallback 14 trường
   ═══════════════════════════════════════════════════════════════ */

const {
  matchPattern, runLogic, formatOutput, detectLangFromCode,
  chayCayQuyetDinh,
} = require('./logicRunner');
const feedback = require('./brains/feedback');
const logger = require('../utils/logger');

async function xuLy({ tip, problem, userRequestType, owner, context = null }) {
  if (!tip || !tip.nguyenLy) throw new Error('TIP không hợp lệ');
  if (!problem || problem.trim() === '') throw new Error('Vấn đề rỗng');

  logger.info(`🧠 Tiểu não [${userRequestType}]: "${problem.slice(0, 60)}..."`);

  const tipId = tip._id?.toString() || null;

  /* ═══ BƯỚC 1: Match pattern ═══ */
  const hasPatterns = Array.isArray(tip.patterns) && tip.patterns.length > 0;

  if (hasPatterns && tip.logicType) {
    const vars = matchPattern(tip.patterns, problem);

    if (vars) {
      logger.info(`🎯 Match pattern — vars=${JSON.stringify(vars)}`);

      if (tipId) {
        feedback.recordUse(tipId).catch((err) => logger.warn('feedback.recordUse:', err.message));
      }

      const result = await runLogic({
        logicType: tip.logicType,
        logicValue: tip.logicValue,
        vars,
      });

      if (result.success) {
        const answer = formatOutput(tip.outputTpl, vars, result.kq);
        logger.success(`✅ Tiểu não tự tính: ${String(answer).slice(0, 80)}`);

        if (tipId) {
          feedback.recordSuccess(tipId, { source: 'tieuNao' })
            .catch((err) => logger.warn('feedback.recordSuccess:', err.message));
        }

        if (result.isCode || result.isPatch) {
          return {
            answer,
            type: result.isCode ? 'code' : 'patch',
            code: result.kq,
            language: result.language || detectLangFromCode(result.kq),
            output: result.output || '',
            meta: { tipId, matched: true, vars, logicType: tip.logicType, ran: true },
          };
        }

        return {
          answer,
          type: 'no_code',
          code: null, language: null, output: null,
          meta: { tipId, matched: true, vars, logicType: tip.logicType },
        };
      }

      logger.warn(`Match pattern nhưng chạy logic lỗi: ${result.error}`);

      if (tipId) {
        feedback.recordFail(tipId, result.error || 'logic_failed')
          .catch((err) => logger.warn('feedback.recordFail:', err.message));
      }

      if (result.isCode || result.isPatch) {
        return {
          answer: `⚠️ Code chạy lỗi: ${result.error}`,
          type: result.isCode ? 'code' : 'patch',
          code: result.kq,
          language: result.language || detectLangFromCode(result.kq),
          output: result.output || '',
          meta: { tipId, matched: true, vars, logicType: tip.logicType, ran: false, error: result.error },
        };
      }
    } else {
      logger.debug(`Không match pattern nào`);
    }
  }

  /* ═══ BƯỚC 2: [MỚI] Chạy cây quyết định JSON ═══ */
  if (tip.cayQuyetDinhJson && Array.isArray(tip.cayQuyetDinhJson.rules) && tip.cayQuyetDinhJson.rules.length > 0) {
    logger.info(`🌳 Thử chạy cây quyết định (${tip.cayQuyetDinhJson.rules.length} rules)`);

    try {
      const cayResult = await chayCayQuyetDinh({ tip, problem });

      if (cayResult.success) {
        logger.success(`✅ Cây quyết định xử lý được: ${String(cayResult.kq).slice(0, 80)}`);

        if (tipId) {
          feedback.recordUse(tipId).catch((err) => logger.warn('feedback.recordUse:', err.message));
          feedback.recordSuccess(tipId, { source: 'cayQuyetDinh' })
            .catch((err) => logger.warn('feedback.recordSuccess:', err.message));
        }

        // Nếu kết quả là code
        if (cayResult.isCode || cayResult.isPatch || cayResult.language) {
          return {
            answer: cayResult.formatted || String(cayResult.kq),
            type: cayResult.isPatch ? 'patch' : 'code',
            code: cayResult.kq,
            language: cayResult.language || detectLangFromCode(cayResult.kq),
            output: cayResult.output || '',
            meta: { tipId, matched: 'cayQuyetDinh', vars: cayResult.vars, ran: true },
          };
        }

        // Kết quả là text/expr
        return {
          answer: cayResult.formatted || String(cayResult.kq),
          type: 'no_code',
          code: null, language: null, output: null,
          meta: { tipId, matched: 'cayQuyetDinh', vars: cayResult.vars },
        };
      }

      logger.debug(`Cây không xử lý được: ${cayResult.error}`);
    } catch (err) {
      logger.warn(`Chạy cây lỗi: ${err.message}`);
    }
  }

  /* ═══ FALLBACK — Nhánh E ═══ */
  return {
    answer: formatTIPDayDu(tip),
    type: 'no_code',
    code: null, language: null, output: null,
    meta: { tipId, matched: false },
  };
}

/* ═══════════════════════════════════════════════════════════════
   FORMAT 14 TRƯỜNG — Nhánh E
   ═══════════════════════════════════════════════════════════════ */

function formatTIPDayDu(tip) {
  const parts = [];

  parts.push(`📌 **Nguyên lý:**\n${tip.nguyenLy || '(chưa có)'}`);
  if (tip.quyTac) parts.push(`\n📏 **Quy tắc:**\n${tip.quyTac}`);
  if (tip.dieuKien) parts.push(`\n🔗 **Điều kiện:**\n${tip.dieuKien}`);
  if (tip.cayQuyetDinh) parts.push(`\n🌳 **Cây quyết định:**\n${tip.cayQuyetDinh}`);
  if (tip.phuongPhap) parts.push(`\n🛠️ **Phương pháp:**\n${tip.phuongPhap}`);
  if (tip.thuatToan) parts.push(`\n⚙️ **Thuật toán:**\n${tip.thuatToan}`);
  if (tip.workflow) parts.push(`\n🔄 **Workflow:**\n${tip.workflow}`);
  if (tip.suyLuan) parts.push(`\n🧠 **Suy luận:**\n${tip.suyLuan}`);
  if (tip.testCase) parts.push(`\n🧪 **Test case:**\n${tip.testCase}`);
  if (tip.kiemChung) parts.push(`\n🔍 **Kiểm chứng:**\n${tip.kiemChung}`);
  if (tip.ngoaiLe) parts.push(`\n⚠️ **Ngoại lệ:**\n${tip.ngoaiLe}`);
  if (tip.caseKinhNghiem) parts.push(`\n💡 **Case:**\n${tip.caseKinhNghiem}`);
  if (tip.nguonPhienBan) parts.push(`\n📚 **Nguồn:** ${tip.nguonPhienBan}`);

  return parts.join('\n');
}

module.exports = { xuLy, formatTIPDayDu };