/* ═══════════════════════════════════════════════════════════════
   ⚙️ MACHINE ENGINE — Chạy 14 trường JSON của TIP
   Không cần model, không cần Piston
   ═══════════════════════════════════════════════════════════════ */

const { evaluate } = require('mathjs');
const logger = require('../utils/logger');

/**
 * Chạy TIP với vars đầu vào
 * @returns { success, kq, verified, error, steps }
 */
function runTIP(tip, vars) {
  const steps = [];

  try {
    // ═══ 1. Kiểm ngoại lệ ═══
    if (Array.isArray(tip.ngoaiLe)) {
      for (const ex of tip.ngoaiLe) {
        if (!ex.when) continue;
        if (safeEval(ex.when, vars)) {
          steps.push({ stage: 'ngoaiLe', when: ex.when, msg: ex.msg });
          return {
            success: false,
            error: ex.msg || 'Ngoại lệ',
            steps,
          };
        }
      }
    }

    // ═══ 2. Kiểm điều kiện ═══
    if (Array.isArray(tip.dieuKien)) {
      for (const dk of tip.dieuKien) {
        if (!checkDieuKien(dk, vars)) {
          steps.push({ stage: 'dieuKien', failed: dk });
          return {
            success: false,
            error: `Không thỏa điều kiện: ${dk.var} ${dk.op} ${dk.value}`,
            steps,
          };
        }
      }
    }

    // ═══ 3. Rẽ nhánh cây quyết định ═══
    if (tip.cayQuyetDinh && typeof tip.cayQuyetDinh === 'object') {
      const branch = resolveBranch(tip.cayQuyetDinh, vars);
      steps.push({ stage: 'cayQuyetDinh', branch });

      if (branch && branch.action === 'error') {
        return { success: false, error: branch.msg || 'Lỗi', steps };
      }

      if (branch && branch.action === 'return') {
        const val = branch.value !== undefined
          ? safeEval(branch.value, vars)
          : branch.var !== undefined
            ? vars[branch.var]
            : null;
        return { success: true, kq: val, verified: true, steps };
      }

      if (branch && branch.action === 'compute' && branch.expr) {
        const kq = safeEval(branch.expr, vars);
        return verifyTIP(tip, { ...vars, kq }, kq, steps);
      }
    }

    // ═══ 4. Chạy thuật toán từng bước ═══
    const scope = { ...vars };
    let kq = null;

    if (Array.isArray(tip.thuatToan) && tip.thuatToan.length > 0) {
      const sorted = [...tip.thuatToan].sort((a, b) => (a.step || 0) - (b.step || 0));

      for (const s of sorted) {
        if (s.op === 'compute') {
          try {
            const val = safeEval(s.expr, scope);
            const resultVar = s.result || 'kq';
            scope[resultVar] = val;
            steps.push({ stage: 'compute', expr: s.expr, [resultVar]: val });
          } catch (err) {
            return { success: false, error: `Bước ${s.step} compute lỗi: ${err.message}`, steps };
          }
        } else if (s.op === 'check') {
          if (!safeEval(s.cond, scope)) {
            return { success: false, error: `Bước ${s.step} check fail: ${s.cond}`, steps };
          }
          steps.push({ stage: 'check', cond: s.cond, pass: true });
        } else if (s.op === 'return') {
          const varName = s.var;
          if (varName && scope[varName] !== undefined) {
            kq = scope[varName];
          } else if (varName) {
            try { kq = safeEval(varName, scope); } catch { kq = varName; }
          } else if (s.value !== undefined) {
            kq = s.value;
          } else if (s.expr) {
            kq = safeEval(s.expr, scope);
          }
          steps.push({ stage: 'return', kq });
          break;
        }
      }
    }

    if (kq === null) kq = scope.kq;

    // ═══ 5. Verify bằng kiemChung ═══
    return verifyTIP(tip, { ...scope, kq }, kq, steps);

  } catch (err) {
    logger.warn(`Machine engine lỗi: ${err.message}`);
    return { success: false, error: err.message, steps };
  }
}

/**
 * Check điều kiện { var, op, value }
 */
function checkDieuKien(dk, vars) {
  const v = vars[dk.var];
  const target = dk.value;

  switch (dk.op) {
    case '==': return v == target;
    case '!=': return v != target;
    case '>':  return v > target;
    case '>=': return v >= target;
    case '<':  return v < target;
    case '<=': return v <= target;
    default:   return true;
  }
}

/**
 * Rẽ nhánh cây quyết định
 */
function resolveBranch(cay, vars) {
  if (cay.if && safeEval(cay.if, vars)) {
    return cay.then;
  }

  if (Array.isArray(cay.elseIf)) {
    for (const ei of cay.elseIf) {
      if (ei.if && safeEval(ei.if, vars)) return ei.then;
    }
  }

  if (cay.else) return cay.else;

  return null;
}

/**
 * Verify bằng kiemChung
 */
function verifyTIP(tip, scope, kq, steps) {
  let verified = true;

  if (tip.kiemChung && typeof tip.kiemChung === 'object' && tip.kiemChung.expr) {
    try {
      verified = !!safeEval(tip.kiemChung.expr, scope);
      steps.push({ stage: 'kiemChung', expr: tip.kiemChung.expr, pass: verified });
    } catch (err) {
      verified = false;
      steps.push({ stage: 'kiemChung', error: err.message });
    }
  }

  return { success: true, kq, verified, steps };
}

/**
 * Evaluate an toàn — catch lỗi
 */
function safeEval(expr, scope) {
  if (expr === undefined || expr === null) return null;
  if (typeof expr === 'number' || typeof expr === 'boolean') return expr;

  try {
    return evaluate(String(expr), scope || {});
  } catch (err) {
    logger.debug(`safeEval lỗi "${expr}": ${err.message}`);
    return null;
  }
}

/**
 * Chạy test case để kiểm TIP có đúng không
 */
function testTIP(tip) {
  if (!Array.isArray(tip.testCase) || tip.testCase.length === 0) {
    return { allPass: true, results: [] };
  }

  const results = [];

  for (const tc of tip.testCase) {
    if (!tc.input) continue;
    const r = runTIP(tip, tc.input);
    const pass = r.success && (r.kq == tc.expected);
    results.push({
      input: tc.input,
      expected: tc.expected,
      got: r.kq,
      pass,
    });
  }

  return {
    allPass: results.every((r) => r.pass),
    results,
  };
}

module.exports = {
  runTIP,
  testTIP,
  checkDieuKien,
  resolveBranch,
  safeEval,
};