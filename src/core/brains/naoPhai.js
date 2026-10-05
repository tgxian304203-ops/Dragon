/* ═══════════════════════════════════════════════════════════════
   🧠 NÃO PHẢI — Verify nhánh cây gốc
   - [SỬA] Lazy require logicRunner — tránh circular dependency
   ═══════════════════════════════════════════════════════════════ */

const { callModel } = require('./goiModel');
const naoPhaiPrompt = require('./prompts/naoPhai.prompt');
const { webSearch, formatForPrompt } = require('../webSearch');
const { evaluate } = require('mathjs');
const logger = require('../../utils/logger');

const FIELDS_14 = [
  'nguyenLy', 'quyTac', 'dieuKien', 'cayQuyetDinh',
  'phuongPhap', 'thuatToan', 'workflow', 'suyLuan',
  'testCase', 'kiemChung', 'ngoaiLe', 'caseKinhNghiem',
  'quanHe', 'nguonPhienBan',
];

const MAX_JSON_RETRY = 3;
const MIN_RULES = 5;

function sanitizeJsonText(text) {
  if (!text || typeof text !== 'string') return '';
  let s = text;
  s = s.replace(/[\u200B-\u200D\uFEFF\u00A0]/g, '');
  s = s.replace(/^```(?:json|JSON)?\s*/i, '');
  s = s.replace(/\s*```\s*$/i, '');
  const first = s.indexOf('{');
  const last = s.lastIndexOf('}');
  if (first !== -1 && last > first) s = s.slice(first, last + 1);
  s = s.replace(/,\s*([}\]])/g, '$1');
  s = s.replace(/([{,]\s*)([a-zA-Z_\u00C0-\u1EF9][a-zA-Z0-9_\u00C0-\u1EF9]*)\s*:/g, '$1"$2":');
  return s;
}

function parseJSONFromModel(raw) {
  if (!raw || typeof raw !== 'string') throw new Error('Output rỗng');
  const text = raw.trim();
  const candidates = [text];
  const noMd = text.replace(/```(?:json)?\s*([\s\S]*?)\s*```/gi, '$1').trim();
  if (noMd !== text) candidates.push(noMd);
  const first = text.indexOf('{');
  const last = text.lastIndexOf('}');
  if (first !== -1 && last > first) candidates.push(text.slice(first, last + 1));
  candidates.push(sanitizeJsonText(text));

  let lastErr = null;
  for (const cand of candidates) {
    if (!cand) continue;
    try { return JSON.parse(cand); } catch (err) { lastErr = err; }
  }
  throw new Error(`Không parse được JSON: ${lastErr?.message || 'unknown'}`);
}

function normalizeEvaluation(raw) {
  const missingFields = Array.isArray(raw.missingFields)
    ? raw.missingFields.filter((f) => typeof f === 'string' && FIELDS_14.includes(f.trim())).map((f) => f.trim())
    : [];

  const reason = typeof raw.reason === 'string' ? raw.reason.trim() : '';

  const nt = raw.numericTest || {};
  const numericTest = {
    example: typeof nt.example === 'string' ? nt.example.trim() : '',
    calculation: typeof nt.calculation === 'string' ? nt.calculation.trim() : '',
    expected: typeof nt.expected === 'string' ? nt.expected.trim() : '',
    actual: typeof nt.actual === 'string' ? nt.actual.trim() : '',
    match: nt.match === true,
  };

  const issues = Array.isArray(raw.issues)
    ? raw.issues.filter((i) => i && typeof i === 'object').map((i) => ({
        field: typeof i.field === 'string' ? i.field : '',
        problem: typeof i.problem === 'string' ? i.problem : '',
        severity: ['low', 'medium', 'high'].includes(i.severity) ? i.severity : 'low',
      }))
    : [];

  const suggestions = Array.isArray(raw.suggestions)
    ? raw.suggestions.filter((s) => typeof s === 'string' && s.trim())
    : [];

  const needWebSearch = raw.needWebSearch === true;
  const searchQuery = typeof raw.searchQuery === 'string' ? raw.searchQuery.trim() : '';

  return {
    missingFields, reason, numericTest, issues, suggestions,
    needSupplement: missingFields.length > 0,
    needWebSearch, searchQuery,
  };
}

/* ═══════════════════════════════════════════════════════════════
   VERIFY CƠ BẢN
   ═══════════════════════════════════════════════════════════════ */

/**
 * [SỬA] Lazy require logicRunner — tránh circular dependency.
 */
function verifyPattern(nhanh, originalProblem) {
  if (!originalProblem || !Array.isArray(nhanh.patterns) || nhanh.patterns.length === 0) {
    return { matched: false, vars: null, skip: true };
  }
  try {
    const logicRunner = require('../logicRunner');
    const matchPattern = logicRunner.matchPattern;

    if (typeof matchPattern !== 'function') {
      logger.warn('⚠️ matchPattern không phải function — bỏ qua verify pattern');
      return { matched: false, vars: null, skip: true };
    }

    const vars = matchPattern(nhanh.patterns, originalProblem);
    return { matched: !!vars, vars, skip: false };
  } catch (err) {
    logger.warn(`verifyPattern lỗi: ${err.message}`);
    return { matched: false, vars: null, skip: true };
  }
}

function verifyLogicTypeForIntent(nhanh, originalProblem) {
  if (!originalProblem) return { ok: true };
  const q = originalProblem.toLowerCase();

  const isMath = /\b(tính|toán|phép|cộng|trừ|nhân|chia|tổng|hiệu|tích|thương|mũ|bình phương|[+\-*/^])\b/i.test(q);
  const isCode = /\b(viết|tạo|code|lập trình|hàm|function|script|chương trình)\b/i.test(q);
  const isBugfix = /\b(sửa|fix|debug|lỗi|bug|error|khắc phục)\b/i.test(q);

  const lt = nhanh.logicType || '';

  if (isMath && !isCode && lt !== 'expr') return { ok: false, reason: `Câu hỏi toán nhưng logicType="${lt}"` };
  if (isCode && !isBugfix && !['code', 'patch'].includes(lt)) return { ok: false, reason: `Câu hỏi code nhưng logicType="${lt}"` };
  if (isBugfix && lt !== 'patch') return { ok: false, reason: `Câu hỏi bugfix nhưng logicType="${lt}"` };

  return { ok: true };
}

function verify14Truong(nhanh) {
  const issues = [];
  for (const field of FIELDS_14) {
    const v = nhanh[field];
    if (Array.isArray(v)) {
      if (v.length === 0 && ['quanHe'].includes(field)) continue;
    } else {
      const s = String(v || '').trim();
      if (s === '' && field !== 'quanHe' && field !== 'nguonPhienBan') {
        issues.push({
          field,
          problem: `Trường "${field}" rỗng`,
          severity: 'medium',
        });
      }
    }
  }
  return issues;
}

function verifyCayQuyetDinh(nhanh) {
  const cay = nhanh.cayQuyetDinhJson;
  if (!cay) {
    return { ok: true, skip: true };
  }

  if (!Array.isArray(cay.rules) || cay.rules.length === 0) {
    return { ok: false, reason: 'Cây không có rules', severity: 'high' };
  }

  if (cay.rules.length < MIN_RULES) {
    return { ok: false, reason: `Cây có ${cay.rules.length} rules < ${MIN_RULES}`, severity: 'medium' };
  }

  let invalidRules = 0;
  for (const r of cay.rules) {
    if (!r.if || !r.then || typeof r.then !== 'object') invalidRules++;
  }
  if (invalidRules > 3) {
    return { ok: false, reason: `${invalidRules} rules không hợp lệ`, severity: 'high' };
  }

  return { ok: true };
}

/* ═══════════════════════════════════════════════════════════════
   VERIFY EXPR
   ═══════════════════════════════════════════════════════════════ */

function coSoCungTrongExpr(logicValue) {
  if (typeof logicValue !== 'string') return false;
  if (logicValue.trim() === '') return false;

  let check = logicValue.replace(/sum\s*\(\s*\[[^\]]*\]\s*\)/gi, 'SUM');
  check = check.replace(/\b(PI|E|pi|e)\b/g, 'CONST');

  const soCung = check.match(/\b\d+(?:\.\d+)?\b/g);
  return soCung && soCung.length > 0;
}

function demBienTrongExpr(logicValue) {
  if (typeof logicValue !== 'string') return 0;
  const matches = logicValue.match(/\b[a-i]\b/g) || [];
  return new Set(matches).size;
}

function verifyKhongSoCung(nhanh) {
  const issues = [];

  if (nhanh.logicType === 'expr' && nhanh.logicValue) {
    if (coSoCungTrongExpr(nhanh.logicValue)) {
      issues.push({ field: 'logicValue', problem: `logicValue có số cứng: "${nhanh.logicValue}"`, severity: 'high' });
    }
  }

  if (nhanh.logicType === 'expr' && nhanh.outputTpl) {
    if (coSoCungTrongExpr(nhanh.outputTpl)) {
      issues.push({ field: 'outputTpl', problem: `outputTpl có số cứng: "${nhanh.outputTpl}"`, severity: 'high' });
    }
  }

  if (nhanh.cayQuyetDinhJson && Array.isArray(nhanh.cayQuyetDinhJson.rules)) {
    let countSoCung = 0;
    let viDu = '';
    for (const r of nhanh.cayQuyetDinhJson.rules) {
      if (!r.then) continue;
      if (r.then.logicType === 'expr') {
        if (coSoCungTrongExpr(r.then.logicValue)) {
          countSoCung++;
          if (!viDu) viDu = r.then.logicValue;
        }
      }
    }
    if (countSoCung > 3) {
      issues.push({ field: 'cayQuyetDinhJson', problem: `Cây có ${countSoCung} chỗ dùng số cứng (VD: "${viDu}")`, severity: 'high' });
    }
  }

  return issues;
}

function verifySoBienKhop(nhanh) {
  const issues = [];
  if (!nhanh.cayQuyetDinhJson || !Array.isArray(nhanh.cayQuyetDinhJson.rules)) return issues;

  let countSai = 0;
  let viDu = '';

  for (const r of nhanh.cayQuyetDinhJson.rules) {
    if (!r.then || r.then.logicType !== 'expr') continue;
    const ifCond = String(r.if || '');
    const match = ifCond.match(/soLuongSo\s*==\s*(\d+)/);
    if (!match) continue;

    const soMongDoi = parseInt(match[1], 10);
    const logicValue = String(r.then.logicValue || '');
    if (/sum\s*\(/i.test(logicValue)) continue;

    const soThucTe = demBienTrongExpr(logicValue);
    if (soThucTe !== soMongDoi) {
      countSai++;
      if (!viDu) {
        viDu = `if "${ifCond}" → logicValue "${logicValue}" (mong đợi ${soMongDoi} biến, thực tế ${soThucTe})`;
      }
    }
  }

  if (countSai > 2) {
    issues.push({ field: 'cayQuyetDinhJson', problem: `Cây có ${countSai} rule dùng sai số biến. VD: ${viDu}`, severity: 'high' });
  }

  return issues;
}

/* ═══════════════════════════════════════════════════════════════
   VERIFY CODE
   ═══════════════════════════════════════════════════════════════ */

function coPlaceholderTrongCode(code) {
  if (typeof code !== 'string') return false;
  if (code.trim() === '') return false;

  let check = code.replace(/\$\{[^}]+\}/g, 'JSVAR');
  check = check.replace(/\{[^}]*:[^}]*;[^}]*\}/g, 'CSSBLOCK');
  check = check.replace(/@media[^{]*\{[^}]*\}/gi, 'CSSMEDIA');

  const placeholders = check.match(/\{(?:[a-h]|[a-z_]+)\}/gi);
  if (placeholders && placeholders.length > 2) return true;
  return false;
}

function verifyCodeKhongPlaceholder(nhanh) {
  const issues = [];

  const checkCode = (code, fieldName, context = '') => {
    if (coPlaceholderTrongCode(code)) {
      const placeholders = String(code).match(/\{(?:[a-h]|[a-z_]+)\}/gi) || [];
      issues.push({ field: fieldName, problem: `${context}code có placeholder ${placeholders.slice(0, 5).join(', ')}`, severity: 'high' });
    }
  };

  if ((nhanh.logicType === 'code' || nhanh.logicType === 'patch') && nhanh.logicValue) {
    checkCode(nhanh.logicValue, 'logicValue');
  }

  if ((nhanh.logicType === 'code' || nhanh.logicType === 'patch') && nhanh.outputTpl) {
    const tplClean = nhanh.outputTpl.replace(/\{kq\}/g, '');
    if (coPlaceholderTrongCode(tplClean)) {
      const placeholders = tplClean.match(/\{(?:[a-h]|[a-z_]+)\}/gi) || [];
      issues.push({ field: 'outputTpl', problem: `outputTpl có placeholder ${placeholders.slice(0, 5).join(', ')}`, severity: 'high' });
    }
  }

  return issues;
}

/* ═══════════════════════════════════════════════════════════════
   CHẠY TESTS
   ═══════════════════════════════════════════════════════════════ */

function parseNum(v) {
  if (typeof v === 'number') return v;
  const s = String(v).replace(',', '.');
  const n = Number(s);
  return Number.isNaN(n) ? v : n;
}

function runTests(nhanh) {
  if (!Array.isArray(nhanh.tests) || nhanh.tests.length === 0) return { allPass: true, results: [] };
  if (nhanh.logicType !== 'expr' || !nhanh.logicValue) return { allPass: true, results: [], skipped: true };

  const results = [];
  for (const tc of nhanh.tests) {
    try {
      const scope = {};
      for (const [k, v] of Object.entries(tc.input || {})) scope[k] = parseNum(v);
      const got = evaluate(nhanh.logicValue, scope);
      const pass = got == tc.expected;
      results.push({ input: tc.input, expected: tc.expected, got, pass });
    } catch (err) {
      results.push({ input: tc.input, expected: tc.expected, got: null, pass: false, error: err.message });
    }
  }
  return { allPass: results.every((r) => r.pass), results };
}

/* ═══════════════════════════════════════════════════════════════
   GỌI MODEL
   ═══════════════════════════════════════════════════════════════ */

async function goiPhaiVaParse({ owner, messages, tempKeys, label }) {
  const excludeModels = new Set();
  let lastErr = null;

  for (let attempt = 1; attempt <= MAX_JSON_RETRY; attempt++) {
    let result;
    try {
      result = await callModel({
        side: 'right',
        userId: owner.userId,
        guestSessionId: owner.guestSessionId,
        messages,
        options: { temperature: 0.3, maxTokens: 2048, excludeModels: [...excludeModels], responseFormat: 'json' },
        tempKeys,
      });
    } catch (err) {
      lastErr = err;
      logger.error(`${label} — gọi model lỗi lần ${attempt}:`, err.message);
      continue;
    }

    try {
      const rawObj = parseJSONFromModel(result.text);
      const evaluation = normalizeEvaluation(rawObj);
      return { evaluation, meta: { provider: result.provider, modelId: result.modelId, keyId: result.keyId, usage: result.usage, attempts: attempt } };
    } catch (parseErr) {
      lastErr = parseErr;
      logger.warn(`${label} — parse JSON lỗi lần ${attempt}: ${parseErr.message}`);
      excludeModels.add(result.modelId);
    }
  }

  throw new Error(`${label} thất bại sau ${MAX_JSON_RETRY} lần. Lỗi cuối: ${lastErr?.message || 'unknown'}`);
}

/* ═══════════════════════════════════════════════════════════════
   HÀM CHÍNH
   ═══════════════════════════════════════════════════════════════ */

async function kiemChung({ nhanh, originalProblem = '', owner, tempKeys = null }) {
  if (!nhanh || typeof nhanh !== 'object') throw new Error('Nhánh không hợp lệ');
  if (!nhanh.nguyenLy || nhanh.nguyenLy.trim() === '') throw new Error('Nhánh thiếu nguyenLy');
  if (!owner || (!owner.userId && !owner.guestSessionId && !tempKeys)) throw new Error('Thiếu owner');

  const issues = [];

  /* BƯỚC 1 — Pattern match câu gốc */
  const patternCheck = verifyPattern(nhanh, originalProblem);
  if (originalProblem && Array.isArray(nhanh.patterns) && nhanh.patterns.length > 0) {
    // Chỉ push issue nếu pattern THỰC SỰ không match (không phải lỗi technical)
    if (!patternCheck.matched && !patternCheck.skip) {
      logger.warn(`⚠️ Não phải: pattern KHÔNG match câu gốc`);
      issues.push({ field: 'patterns', problem: `Pattern không match câu hỏi gốc`, severity: 'high' });
    } else if (patternCheck.skip) {
      logger.warn(`⚠️ Não phải: bỏ qua verify pattern (lỗi technical)`);
    }
  }

  /* BƯỚC 2 — LogicType khớp intent */
  const logicCheck = verifyLogicTypeForIntent(nhanh, originalProblem);
  if (!logicCheck.ok) {
    logger.warn(`⚠️ Não phải: logicType không phù hợp — ${logicCheck.reason}`);
    issues.push({ field: 'logicType', problem: logicCheck.reason, severity: 'high' });
  }

  /* BƯỚC 3 — 14 trường đầy đủ */
  const fieldsIssues = verify14Truong(nhanh);
  if (fieldsIssues.length > 0) {
    logger.warn(`⚠️ Não phải: ${fieldsIssues.length} trường thiếu`);
    issues.push(...fieldsIssues);
  }

  /* BƯỚC 4 — Cây quyết định */
  const cayCheck = verifyCayQuyetDinh(nhanh);
  if (!cayCheck.ok) {
    logger.warn(`⚠️ Não phải: cây không hợp lệ — ${cayCheck.reason}`);
    issues.push({ field: 'cayQuyetDinhJson', problem: cayCheck.reason, severity: cayCheck.severity });
  }

  /* BƯỚC 5 — Không số cứng */
  const soCungIssues = verifyKhongSoCung(nhanh);
  if (soCungIssues.length > 0) {
    logger.warn(`⚠️ Não phải: có ${soCungIssues.length} chỗ dùng số cứng`);
    issues.push(...soCungIssues);
  }

  /* BƯỚC 6 — Rule khớp số biến */
  const soBienIssues = verifySoBienKhop(nhanh);
  if (soBienIssues.length > 0) {
    logger.warn(`⚠️ Não phải: có ${soBienIssues.length} rule sai số biến`);
    issues.push(...soBienIssues);
  }

  /* BƯỚC 7 — Code không placeholder */
  const placeholderIssues = verifyCodeKhongPlaceholder(nhanh);
  if (placeholderIssues.length > 0) {
    logger.warn(`⚠️ Não phải: code có ${placeholderIssues.length} chỗ dùng placeholder`);
    issues.push(...placeholderIssues);
  }

  /* BƯỚC 8 — Chạy tests */
  const testResult = runTests(nhanh);
  if (!testResult.allPass) {
    issues.push({ field: 'logicValue', problem: `Test fail`, severity: 'high' });
  }

  /* BƯỚC 9 — Có issue high → fail */
  const highIssues = issues.filter((i) => i.severity === 'high');

  if (highIssues.length > 0) {
    logger.warn(`🧠 Não phải: ${highIssues.length} issue high — fail`);

    const missingFromIssues = [...new Set(highIssues.map((i) => i.field).filter((f) => FIELDS_14.includes(f) || ['patterns', 'logicType', 'logicValue', 'outputTpl', 'cayQuyetDinhJson'].includes(f)))];

    return {
      evaluation: {
        missingFields: missingFromIssues,
        reason: `Có ${highIssues.length} lỗi`,
        numericTest: { example: '', calculation: '', expected: '', actual: '', match: false },
        issues,
        suggestions: ['Sửa để pass verify'],
        needSupplement: true,
        needWebSearch: false,
        searchQuery: '',
        testsFailed: !testResult.allPass,
      },
      meta: { provider: 'local', testResult, patternCheck: { matched: patternCheck.matched }, logicCheck, cayCheck },
    };
  }

  /* BƯỚC 10 — Gọi model verify ngữ nghĩa */
  const userMessage = naoPhaiPrompt.buildUserMessage({ nhanh, originalProblem });
  const messages = [
    { role: 'system', content: naoPhaiPrompt.SYSTEM_PROMPT },
    { role: 'user', content: userMessage },
  ];

  logger.info(`🧠 Não phải kiểm nhánh "${nhanh.id}": "${nhanh.nguyenLy.slice(0, 60)}..."`);

  const { evaluation, meta } = await goiPhaiVaParse({ owner, messages, tempKeys, label: '🧠 Não phải' });

  /* BƯỚC 11 — Web verify */
  if (evaluation.needWebSearch && evaluation.searchQuery) {
    try {
      const searchResult = await webSearch(evaluation.searchQuery);
      const webText = formatForPrompt(searchResult);
      const messages2 = [
        { role: 'system', content: naoPhaiPrompt.SYSTEM_PROMPT },
        { role: 'user', content: userMessage },
        { role: 'assistant', content: JSON.stringify(evaluation) },
        { role: 'user', content: `🌐 WEB:\n${webText}\n\nKiểm lại và trả JSON cuối.` },
      ];

      const { evaluation: evaluation2, meta: meta2 } = await goiPhaiVaParse({ owner, messages: messages2, tempKeys, label: '🧠 Não phải (web)' });

      return {
        evaluation: evaluation2,
        meta: { ...meta2, webVerified: true, testResult, patternCheck, logicCheck, cayCheck },
      };
    } catch (err) {
      logger.warn(`Web verify lỗi: ${err.message}`);
    }
  }

  return { evaluation, meta: { ...meta, testResult, patternCheck, logicCheck, cayCheck } };
}

module.exports = {
  kiemChung, parseJSONFromModel, normalizeEvaluation,
  runTests, verifyPattern, verifyLogicTypeForIntent, verifyCayQuyetDinh,
  coSoCungTrongExpr, verifyKhongSoCung,
  coPlaceholderTrongCode, verifyCodeKhongPlaceholder,
  demBienTrongExpr, verifySoBienKhop, verify14Truong,
};