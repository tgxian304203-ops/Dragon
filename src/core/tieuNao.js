/* ═══════════════════════════════════════════════════════════════
   🧠 TIỂU NÃO — Match pattern → chạy logic (không model)
   - Nhánh A: expr (mathjs)
   - Nhánh B: code (Judge0)
   - Nhánh C: patch (Judge0)
   - Nhánh D: fallback (hiện 14 trường)
   ═══════════════════════════════════════════════════════════════ */

const { matchPattern, runLogic, formatOutput, detectLangFromCode } = require('./logicRunner');
const logger = require('../utils/logger');

async function xuLy({ tip, problem, userRequestType, owner, context = null }) {
  if (!tip || !tip.nguyenLy) throw new Error('TIP không hợp lệ');
  if (!problem || problem.trim() === '') throw new Error('Vấn đề rỗng');

  logger.info(`🧠 Tiểu não [${userRequestType}]: "${problem.slice(0, 60)}..."`);

  // ═══ BƯỚC 1: Match pattern ═══
  const hasPatterns = Array.isArray(tip.patterns) && tip.patterns.length > 0;

  if (hasPatterns && tip.logicType) {
    const vars = matchPattern(tip.patterns, problem);

    if (vars) {
      logger.info(`🎯 Match pattern — vars=${JSON.stringify(vars)}`);

      // ═══ BƯỚC 2: Chạy logic (async — vì có thể gọi Judge0) ═══
      const result = await runLogic({
        logicType: tip.logicType,
        logicValue: tip.logicValue,
        vars,
      });

      if (result.success) {
        const answer = formatOutput(tip.outputTpl, vars, result.kq);

        logger.success(`✅ Tiểu não tự tính: ${String(answer).slice(0, 80)}`);

        // Với nhánh code/patch — trả đủ code + output + language để UI hiển thị tách riêng
        if (result.isCode || result.isPatch) {
          return {
            answer,
            type: result.isCode ? 'code' : 'patch',
            code: result.kq,
            language: result.language || detectLangFromCode(result.kq),
            output: result.output || '',
            meta: {
              tipId: tip._id?.toString() || null,
              matched: true,
              vars,
              logicType: tip.logicType,
              ran: true,
            },
          };
        }

        // Nhánh expr — không có code
        return {
          answer,
          type: 'no_code',
          code: null,
          language: null,
          output: null,
          meta: {
            tipId: tip._id?.toString() || null,
            matched: true,
            vars,
            logicType: tip.logicType,
          },
        };
      }

      logger.warn(`Match pattern nhưng chạy logic lỗi: ${result.error}`);

      // Nếu là code/patch chạy lỗi — vẫn trả code cho user, kèm lỗi
      if (result.isCode || result.isPatch) {
        return {
          answer: `⚠️ Code chạy lỗi: ${result.error}`,
          type: result.isCode ? 'code' : 'patch',
          code: result.kq,
          language: result.language || detectLangFromCode(result.kq),
          output: result.output || '',
          meta: {
            tipId: tip._id?.toString() || null,
            matched: true,
            vars,
            logicType: tip.logicType,
            ran: false,
            error: result.error,
          },
        };
      }
    } else {
      logger.debug(`Không match pattern nào trong TIP`);
    }
  }

  // ═══ FALLBACK: Không match → format TIP đầy đủ ═══
  return {
    answer: formatTIPDayDu(tip),
    type: 'no_code',
    code: null,
    language: null,
    output: null,
    meta: {
      tipId: tip._id?.toString() || null,
      matched: false,
    },
  };
}

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