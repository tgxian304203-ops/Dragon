/* ═══════════════════════════════════════════════════════════════
   🧠 TIỂU NÃO — Match pattern → chạy logic (không model)
   - Nhánh A: expr (mathjs)
   - Nhánh B: code (Judge0)
   - Nhánh C: patch (Judge0)
   - Nhánh D: fallback (hiện 14 trường)
   - Tích hợp feedback.recordUse/recordSuccess/recordFail
   ═══════════════════════════════════════════════════════════════ */

const { matchPattern, runLogic, formatOutput, detectLangFromCode } = require('./logicRunner');
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

      // [MỚI] Ghi nhận TIP được dùng (bất đồng bộ)
      if (tipId) {
        feedback.recordUse(tipId).catch((err) => logger.warn('feedback.recordUse:', err.message));
      }

      /* ═══ BƯỚC 2: Chạy logic ═══ */
      const result = await runLogic({
        logicType: tip.logicType,
        logicValue: tip.logicValue,
        vars,
      });

      if (result.success) {
        const answer = formatOutput(tip.outputTpl, vars, result.kq);

        logger.success(`✅ Tiểu não tự tính: ${String(answer).slice(0, 80)}`);

        // [MỚI] Ghi nhận thành công (bất đồng bộ)
        if (tipId) {
          feedback.recordSuccess(tipId, { source: 'tieuNao' })
            .catch((err) => logger.warn('feedback.recordSuccess:', err.message));
        }

        // Nhánh B/C — trả đủ code + output + language
        if (result.isCode || result.isPatch) {
          return {
            answer,
            type: result.isCode ? 'code' : 'patch',
            code: result.kq,
            language: result.language || detectLangFromCode(result.kq),
            output: result.output || '',
            meta: {
              tipId,
              matched: true,
              vars,
              logicType: tip.logicType,
              ran: true,
            },
          };
        }

        // Nhánh A — expr
        return {
          answer,
          type: 'no_code',
          code: null,
          language: null,
          output: null,
          meta: {
            tipId,
            matched: true,
            vars,
            logicType: tip.logicType,
          },
        };
      }

      logger.warn(`Match pattern nhưng chạy logic lỗi: ${result.error}`);

      // [MỚI] Ghi nhận thất bại (bất đồng bộ)
      if (tipId) {
        feedback.recordFail(tipId, result.error || 'logic_failed')
          .catch((err) => logger.warn('feedback.recordFail:', err.message));
      }

      // Nhánh B/C chạy lỗi — vẫn trả code cho user
      if (result.isCode || result.isPatch) {
        return {
          answer: `⚠️ Code chạy lỗi: ${result.error}`,
          type: result.isCode ? 'code' : 'patch',
          code: result.kq,
          language: result.language || detectLangFromCode(result.kq),
          output: result.output || '',
          meta: {
            tipId,
            matched: true,
            vars,
            logicType: tip.logicType,
            ran: false,
            error: result.error,
          },
        };
      }

      // Nhánh A lỗi — rơi xuống fallback
    } else {
      logger.debug(`Không match pattern nào trong TIP`);
    }
  }

  /* ═══ FALLBACK — Nhánh D ═══ */
  // Không ghi feedback — vì đây không phải TIP "được chọn" để trả lời,
  // mà là TIP bị dùng làm ngữ cảnh khi không match.
  return {
    answer: formatTIPDayDu(tip),
    type: 'no_code',
    code: null,
    language: null,
    output: null,
    meta: {
      tipId,
      matched: false,
    },
  };
}

/* ═══════════════════════════════════════════════════════════════
   FORMAT 14 TRƯỜNG — Nhánh D
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