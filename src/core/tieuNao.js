/* ═══════════════════════════════════════════════════════════════
   🧠 TIỂU NÃO — Match pattern + tự chạy logic (không cần model)
   ═══════════════════════════════════════════════════════════════ */

const { matchPattern, runLogic, formatOutput } = require('./logicRunner');
const logger = require('../utils/logger');

async function xuLy({ tip, problem, userRequestType, owner, context = null }) {
  if (!tip || !tip.nguyenLy) throw new Error('TIP không hợp lệ');
  if (!problem || problem.trim() === '') throw new Error('Vấn đề rỗng');

  logger.info(`🧠 Tiểu não [${userRequestType}]: "${problem.slice(0, 60)}..."`);

  // ═══ BƯỚC 1: Match pattern ═══
  const hasPatterns = Array.isArray(tip.patterns) && tip.patterns.length > 0;

  if (hasPatterns && tip.logicType && tip.logicValue) {
    const vars = matchPattern(tip.patterns, problem);

    if (vars) {
      logger.info(`🎯 Match pattern — vars=${JSON.stringify(vars)}`);

      // ═══ BƯỚC 2: Chạy logic ═══
      const result = runLogic({
        logicType: tip.logicType,
        logicValue: tip.logicValue,
        vars,
      });

      if (result.success) {
        // ═══ BƯỚC 3: Format output ═══
        const answer = formatOutput(tip.outputTpl, vars, result.kq);

        logger.success(`✅ Tiểu não tự tính: ${String(answer).slice(0, 80)}`);

        return {
          answer,
          type: result.isCode ? 'code' : (result.isPatch ? 'patch' : 'no_code'),
          code: result.isCode ? result.kq : null,
          language: result.isCode ? detectLangFromCode(result.kq) : null,
          meta: {
            tipId: tip._id?.toString() || null,
            matched: true,
            vars,
            logicType: tip.logicType,
          },
        };
      }

      logger.warn(`Match pattern nhưng chạy logic lỗi: ${result.error}`);
    } else {
      logger.debug(`Không match pattern nào trong TIP`);
    }
  }

  // ═══ FALLBACK: Không match → format TIP đầy đủ ═══
  return {
    answer: formatTIPDayDu(tip),
    type: 'no_code',
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

function detectLangFromCode(code) {
  if (!code) return 'python';
  if (/^\s*def\s+\w+\s*\(|print\s*\(/m.test(code)) return 'python';
  if (/^\s*function\s+\w+\s*\(|console\.log/m.test(code)) return 'javascript';
  if (/^\s*public\s+class|System\.out\.println/m.test(code)) return 'java';
  if (/^\s*#include|int\s+main\s*\(/m.test(code)) return 'cpp';
  return 'python';
}

module.exports = { xuLy, formatTIPDayDu };