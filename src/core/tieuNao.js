/* ═══════════════════════════════════════════════════════════════
   🧠 TIỂU NÃO — Match pattern → chạy machineEngine (không model)
   ═══════════════════════════════════════════════════════════════ */

const { matchPattern } = require('./logicRunner');
const { runTIP } = require('./machineEngine');
const logger = require('../utils/logger');

async function xuLy({ tip, problem, userRequestType, owner, context = null }) {
  if (!tip || !tip.nguyenLy) throw new Error('TIP không hợp lệ');
  if (!problem || problem.trim() === '') throw new Error('Vấn đề rỗng');

  logger.info(`🧠 Tiểu não [${userRequestType}]: "${problem.slice(0, 60)}..."`);

  // ═══ BƯỚC 1: Match pattern ═══
  const hasPatterns = Array.isArray(tip.patterns) && tip.patterns.length > 0;

  if (hasPatterns) {
    const vars = matchPattern(tip.patterns, problem);

    if (vars) {
      logger.info(`🎯 Match pattern — vars=${JSON.stringify(vars)}`);

      // ═══ BƯỚC 2: Chạy machineEngine ═══
      if (tip.logicType === 'machine' || tip.thuatToan || tip.cayQuyetDinh) {
        const result = runTIP(tip, vars);

        logger.debug(`Engine result: success=${result.success}, verified=${result.verified}, kq=${result.kq}`);

        if (result.success) {
          // Format output
          const answer = formatOutput(tip.outputTpl, vars, result.kq);

          logger.success(`✅ Tiểu não tự tính: ${String(answer).slice(0, 80)}`);

          return {
            answer,
            type: 'no_code',
            meta: {
              tipId: tip._id?.toString() || null,
              matched: true,
              vars,
              kq: result.kq,
              verified: result.verified,
              steps: result.steps?.length || 0,
            },
          };
        }

        logger.warn(`Engine fail: ${result.error}`);
      }
    } else {
      logger.debug(`Không match pattern nào`);
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

/**
 * Format output theo template
 */
function formatOutput(tpl, vars, kq) {
  if (!tpl) return String(kq);

  let out = String(tpl);

  for (const [k, v] of Object.entries(vars || {})) {
    out = out.replace(new RegExp(`\\{${k}\\}`, 'g'), v);
  }

  out = out.replace(/\{kq\}/g, String(kq));

  return out;
}

/**
 * Format TIP đầy đủ khi không match — hiển thị 14 trường
 */
function formatTIPDayDu(tip) {
  const parts = [];

  // Nguyên lý
  if (tip.nguyenLy) {
    parts.push(`📌 **Nguyên lý:**\n${tip.nguyenLy}`);
  }

  // Quy tắc
  if (Array.isArray(tip.quyTac) && tip.quyTac.length > 0) {
    parts.push(`\n📏 **Quy tắc:**`);
    tip.quyTac.forEach((q, i) => parts.push(`${i + 1}. ${q}`));
  }

  // Điều kiện
  if (Array.isArray(tip.dieuKien) && tip.dieuKien.length > 0) {
    parts.push(`\n🔗 **Điều kiện:**`);
    tip.dieuKien.forEach((d) => parts.push(`- ${d.var} ${d.op} ${d.value}`));
  }

  // Cây quyết định
  if (tip.cayQuyetDinh) {
    parts.push(`\n🌳 **Cây quyết định:**`);
    parts.push(`- Nếu: ${tip.cayQuyetDinh.if || '?'}`);
    if (tip.cayQuyetDinh.then) {
      parts.push(`  → ${tip.cayQuyetDinh.then.action || '?'}`);
    }
    if (tip.cayQuyetDinh.else) {
      parts.push(`- Ngược lại: ${tip.cayQuyetDinh.else.action || '?'}`);
    }
  }

  // Phương pháp
  if (tip.phuongPhap) {
    parts.push(`\n🛠️ **Phương pháp:**\n${tip.phuongPhap}`);
  }

  // Thuật toán
  if (Array.isArray(tip.thuatToan) && tip.thuatToan.length > 0) {
    parts.push(`\n⚙️ **Thuật toán:**`);
    tip.thuatToan.forEach((s) => {
      const desc = s.op === 'compute' ? `Tính ${s.expr}` :
                   s.op === 'check' ? `Kiểm ${s.cond}` :
                   s.op === 'return' ? `Trả ${s.var || s.value || 'kq'}` :
                   s.op;
      parts.push(`Bước ${s.step}: ${desc}`);
    });
  }

  // Workflow
  if (tip.workflow) {
    parts.push(`\n🔄 **Workflow:**`);
    if (tip.workflow.input) parts.push(`- Input: ${tip.workflow.input.join(', ')}`);
    if (tip.workflow.process) parts.push(`- Xử lý: ${tip.workflow.process.join(' → ')}`);
    if (tip.workflow.output) parts.push(`- Output: ${tip.workflow.output}`);
  }

  // Suy luận
  if (Array.isArray(tip.suyLuan) && tip.suyLuan.length > 0) {
    parts.push(`\n🧠 **Suy luận:**`);
    tip.suyLuan.forEach((s) => parts.push(`- ${s}`));
  }

  // Test case
  if (Array.isArray(tip.testCase) && tip.testCase.length > 0) {
    parts.push(`\n🧪 **Test case:**`);
    tip.testCase.forEach((tc) => {
      parts.push(`- ${JSON.stringify(tc.input)} → ${tc.expected}`);
    });
  }

  // Kiểm chứng
  if (tip.kiemChung && tip.kiemChung.expr) {
    parts.push(`\n🔍 **Kiểm chứng:** ${tip.kiemChung.expr}`);
  }

  // Ngoại lệ
  if (Array.isArray(tip.ngoaiLe) && tip.ngoaiLe.length > 0) {
    parts.push(`\n⚠️ **Ngoại lệ:**`);
    tip.ngoaiLe.forEach((e) => parts.push(`- Khi ${e.when}: ${e.msg}`));
  }

  // Case
  if (Array.isArray(tip.caseKinhNghiem) && tip.caseKinhNghiem.length > 0) {
    parts.push(`\n💡 **Case:**`);
    tip.caseKinhNghiem.forEach((c) => parts.push(`- ${c}`));
  }

  // Quan hệ
  if (Array.isArray(tip.quanHe) && tip.quanHe.length > 0) {
    parts.push(`\n🔗 **Quan hệ:** ${tip.quanHe.join(', ')}`);
  }

  // Nguồn
  if (tip.nguonPhienBan) {
    parts.push(`\n📚 **Nguồn:** ${tip.nguonPhienBan}`);
  }

  return parts.join('\n');
}

module.exports = { xuLy, formatTIPDayDu, formatOutput };