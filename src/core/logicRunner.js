/* ═══════════════════════════════════════════════════════════════
   🎯 LOGIC RUNNER — Match pattern + chạy logic
   ═══════════════════════════════════════════════════════════════ */

const { evaluate } = require('mathjs');
const logger = require('../utils/logger');

/**
 * Chuẩn hóa câu hỏi — thêm space quanh toán tử
 */
function normalizeQuery(query) {
  if (!query || typeof query !== 'string') return '';

  let s = query.trim();

  // Thêm space quanh toán tử nếu thiếu
  s = s.replace(/(\d)\s*([+\-*/^=])\s*(\d)/g, '$1 $2 $3');

  // Gộp space
  s = s.replace(/\s+/g, ' ').trim();

  return s;
}

/**
 * Chuyển pattern "{a} cộng {b}" → regex
 * - Space → \s*
 * - {a}, {b} → group số
 */
function patternToRegex(pattern) {
  let s = String(pattern);

  // Gộp space
  s = s.replace(/\s+/g, ' ').trim();

  // Đánh dấu placeholder
  s = s.replace(/\{a\}/g, '\u0001NUM\u0001');
  s = s.replace(/\{b\}/g, '\u0001NUM\u0001');
  s = s.replace(/\{c\}/g, '\u0001NUM\u0001');
  s = s.replace(/\{d\}/g, '\u0001NUM\u0001');
  s = s.replace(/\{n\}/g, '\u0001NUM\u0001');
  s = s.replace(/\{name\}/g, '\u0001STR\u0001');
  s = s.replace(/\{code\}/g, '\u0001CODE\u0001');
  s = s.replace(/\{error\}/g, '\u0001CODE\u0001');
  s = s.replace(/\{text\}/g, '\u0001CODE\u0001');

  // Escape ký tự đặc biệt
  s = s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  // Space → \s*
  s = s.replace(/ /g, '\\s*');

  // Khôi phục placeholder
  s = s.replace(/\u0001NUM\u0001/g, '(-?\\d+(?:\\.\\d+)?)');
  s = s.replace(/\u0001STR\u0001/g, '([\\w\\u00C0-\\u1EF9]+)');
  s = s.replace(/\u0001CODE\u0001/g, '(.+?)');

  return new RegExp('^\\s*' + s + '\\s*$', 'iu');
}

/**
 * Match câu hỏi với patterns → vars
 */
function matchPattern(patterns, query) {
  if (!Array.isArray(patterns) || patterns.length === 0) return null;
  if (!query || typeof query !== 'string') return null;

  const q = normalizeQuery(query);

  for (const p of patterns) {
    try {
      const re = patternToRegex(p);
      const m = q.match(re);

      if (m) {
        const placeholders = [];
        const re2 = /\{(\w+)\}/g;
        let match2;
        while ((match2 = re2.exec(p)) !== null) {
          placeholders.push(match2[1]);
        }

        const vars = {};
        placeholders.forEach((name, i) => {
          vars[name] = m[i + 1];
        });

        logger.debug(`Pattern matched: "${p}" → vars=${JSON.stringify(vars)}`);
        return vars;
      }
    } catch (err) {
      logger.warn(`Pattern lỗi "${p}":`, err.message);
    }
  }

  return null;
}

/**
 * Chạy logic
 */
function runLogic({ logicType, logicValue, vars }) {
  if (!logicType) return { success: false, error: 'Thiếu logicType' };

  if (logicType === 'expr') {
    if (!logicValue) return { success: false, error: 'Thiếu logicValue' };

    try {
      const scope = {};
      for (const [k, v] of Object.entries(vars || {})) {
        const num = Number(v);
        scope[k] = Number.isNaN(num) ? v : num;
      }

      const kq = evaluate(logicValue, scope);
      return { success: true, kq };
    } catch (err) {
      logger.warn(`Logic expr lỗi: ${err.message}`);
      return { success: false, error: err.message };
    }
  }

  if (logicType === 'code') {
    if (!logicValue) return { success: false, error: 'Thiếu logicValue' };

    let code = logicValue;
    for (const [k, v] of Object.entries(vars || {})) {
      code = code.replace(new RegExp(`\\{${k}\\}`, 'g'), v);
    }
    return { success: true, kq: code, isCode: true };
  }

  if (logicType === 'patch') {
    if (!logicValue) return { success: false, error: 'Thiếu logicValue' };

    let patch = logicValue;
    for (const [k, v] of Object.entries(vars || {})) {
      patch = patch.replace(new RegExp(`\\{${k}\\}`, 'g'), v);
    }
    return { success: true, kq: patch, isPatch: true };
  }

  return { success: false, error: `logicType không hỗ trợ: ${logicType}` };
}

/**
 * Format output theo outputTpl
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

module.exports = {
  patternToRegex,
  matchPattern,
  runLogic,
  formatOutput,
  normalizeQuery,
};