/* ═══════════════════════════════════════════════════════════════
   🧠 NÃO PHẢI — Kiểm TIP + chạy tests verify
   - Verify pattern match câu gốc
   - Verify logicType khớp intent
   - Chạy tests mathjs cho expr
   ═══════════════════════════════════════════════════════════════ */

const { callModel } = require('./goiModel');
const naoPhaiPrompt = require('./prompts/naoPhai.prompt');
const { webSearch, formatForPrompt } = require('../webSearch');
const { evaluate } = require('mathjs');
const { matchPattern } = require('../logicRunner');
const logger = require('../../utils/logger');

const FIELDS_14 = [
  'nguyenLy', 'quyTac', 'dieuKien', 'cayQuyetDinh',
  'phuongPhap', 'thuatToan', 'workflow', 'suyLuan',
  'testCase', 'kiemChung', 'ngoaiLe', 'caseKinhNghiem',
  'quanHe', 'nguonPhienBan',
];

const MAX_JSON_RETRY = 3;

/* ═══════════════════════════════════════════════════════════════
   SANITIZE + PARSE JSON
   ═══════════════════════════════════════════════════════════════ */

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
  s = s.replace(
    /([{,]\s*)([a-zA-Z_\u00C0-\u1EF9][a-zA-Z0-9_\u00C0-\u1EF9]*)\s*:/g,
    '$1"$2":'
  );
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
  if (first !== -1 && last > first) {
    candidates.push(text.slice(first, last + 1));
  }

  candidates.push(sanitizeJsonText(text));

  let lastErr = null;
  for (const cand of candidates) {
    if (!cand) continue;
    try { return JSON.parse(cand); } catch (err) { lastErr = err; }
  }

  logger.warn(`❌ Não phải parse JSON fail. Raw (300 ký tự đầu): ${text.slice(0, 300)}`);
  throw new Error(`Không parse được JSON: ${lastErr?.message || 'unknown'}`);
}

/* ═══════════════════════════════════════════════════════════════
   NORMALIZE EVALUATION
   ═══════════════════════════════════════════════════════════════ */

function normalizeEvaluation(raw) {
  const missingFields = Array.isArray(raw.missingFields)
    ? raw.missingFields
        .filter((f) => typeof f === 'string' && FIELDS_14.includes(f.trim()))
        .map((f) => f.trim())
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
    ? raw.issues
        .filter((i) => i && typeof i === 'object')
        .map((i) => ({
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
   VERIFY PATTERN + LOGIC TYPE
   ═══════════════════════════════════════════════════════════════ */

function verifyPattern(tip, originalProblem) {
  if (!originalProblem || !Array.isArray(tip.patterns) || tip.patterns.length === 0) {
    return { matched: false, vars: null };
  }

  try {
    const vars = matchPattern(tip.patterns, originalProblem);
    return { matched: !!vars, vars };
  } catch (err) {
    logger.warn(`verifyPattern lỗi: ${err.message}`);
    return { matched: false, vars: null };
  }
}

/**
 * [MỚI] Verify logicType khớp intent — chặt hơn.
 */
function verifyLogicTypeForIntent(tip, originalProblem) {
  if (!originalProblem) return { ok: true };

  const q = originalProblem.toLowerCase();

  // Câu hỏi toán — phép tính
  const isMath = /\b(tính|toán|phép|cộng|trừ|nhân|chia|tổng|hiệu|tích|thương|mũ|bình phương|[+\-*/^])\b/i.test(q);

  // Câu hỏi viết code
  const isCode = /\b(viết|tạo|code|lập trình|hàm|function|script|chương trình)\b/i.test(q);

  // Câu hỏi sửa code
  const isBugfix = /\b(sửa|fix|debug|lỗi|bug|error|khắc phục)\b/i.test(q);

  const lt = tip.logicType || '';

  /* ═══ Câu hỏi TOÁN — phải là "expr" ═══ */
  if (isMath && !isCode) {
    if (lt !== 'expr') {
      return {
        ok: false,
        reason: `Câu hỏi toán nhưng logicType="${lt}" — phải là "expr"`,
      };
    }

    // Kiểm tra logicValue không phải code
    const lv = String(tip.logicValue || '');
    if (/print\s*\(|def\s+\w+|function\s+\w+|console\.log|=\s*\d+\s*$/m.test(lv)) {
      return {
        ok: false,
        reason: `logicValue chứa code nhưng logicType="expr" — logicValue phải là biểu thức toán`,
      };
    }
  }

  /* ═══ Câu hỏi CODE — phải là "code" hoặc "patch" ═══ */
  if (isCode && !isBugfix) {
    if (!['code', 'patch'].includes(lt)) {
      return {
        ok: false,
        reason: `Câu hỏi code nhưng logicType="${lt}" — phải là "code" hoặc "patch"`,
      };
    }
  }

  /* ═══ Câu hỏi BUGFIX — phải là "patch" ═══ */
  if (isBugfix) {
    if (lt !== 'patch') {
      return {
        ok: false,
        reason: `Câu hỏi bugfix nhưng logicType="${lt}" — phải là "patch"`,
      };
    }
  }

  return { ok: true };
}

/* ═══════════════════════════════════════════════════════════════
   CHẠY TESTS (mathjs cho expr)
   ═══════════════════════════════════════════════════════════════ */

function parseNum(v) {
  if (typeof v === 'number') return v;
  const s = String(v).replace(',', '.');
  const n = Number(s);
  return Number.isNaN(n) ? v : n;
}

function runTests(tip) {
  if (!Array.isArray(tip.tests) || tip.tests.length === 0) {
    return { allPass: true, results: [] };
  }
  if (tip.logicType !== 'expr' || !tip.logicValue) {
    return { allPass: true, results: [], skipped: true };
  }

  const results = [];
  for (const tc of tip.tests) {
    try {
      const scope = {};
      for (const [k, v] of Object.entries(tc.input || {})) {
        scope[k] = parseNum(v);
      }
      const got = evaluate(tip.logicValue, scope);
      const pass = got == tc.expected;
      results.push({ input: tc.input, expected: tc.expected, got, pass });
    } catch (err) {
      results.push({ input: tc.input, expected: tc.expected, got: null, pass: false, error: err.message });
    }
  }
  return { allPass: results.every((r) => r.pass), results };
}

/* ═══════════════════════════════════════════════════════════════
   GỌI NÃO PHẢI + PARSE
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
        options: {
          temperature: 0.3,
          maxTokens: 2048,
          excludeModels: [...excludeModels],
          responseFormat: 'json',
        },
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
      return {
        evaluation,
        meta: {
          provider: result.provider,
          modelId: result.modelId,
          keyId: result.keyId,
          usage: result.usage,
          attempts: attempt,
        },
      };
    } catch (parseErr) {
      lastErr = parseErr;
      logger.warn(`${label} — parse JSON lỗi lần ${attempt} (model ${result.provider}/${result.modelId}): ${parseErr.message}`);
      excludeModels.add(result.modelId);
    }
  }

  throw new Error(`${label} thất bại sau ${MAX_JSON_RETRY} lần. Lỗi cuối: ${lastErr?.message || 'unknown'}`);
}

/* ═══════════════════════════════════════════════════════════════
   HÀM CHÍNH — KIỂM CHỨNG
   ═══════════════════════════════════════════════════════════════ */

async function kiemChung({ tip, originalProblem = '', owner, tempKeys = null }) {
  if (!tip || typeof tip !== 'object') throw new Error('TIP không hợp lệ');
  if (!tip.nguyenLy || tip.nguyenLy.trim() === '') throw new Error('TIP thiếu nguyenLy');
  if (!owner || (!owner.userId && !owner.guestSessionId && !tempKeys)) {
    throw new Error('Thiếu owner');
  }

  const issues = [];

  /* ═══ BƯỚC 1 — Verify pattern match câu gốc ═══ */
  const patternCheck = verifyPattern(tip, originalProblem);
  if (originalProblem && Array.isArray(tip.patterns) && tip.patterns.length > 0) {
    if (!patternCheck.matched) {
      logger.warn(`⚠️ Não phải: pattern KHÔNG match câu gốc "${originalProblem.slice(0, 60)}"`);
      issues.push({
        field: 'patterns',
        problem: `Pattern không match câu hỏi gốc: "${originalProblem.slice(0, 80)}"`,
        severity: 'high',
      });
    }
  }

  /* ═══ BƯỚC 2 — Verify logicType phù hợp intent ═══ */
  const logicCheck = verifyLogicTypeForIntent(tip, originalProblem);
  if (!logicCheck.ok) {
    logger.warn(`⚠️ Não phải: logicType không phù hợp — ${logicCheck.reason}`);
    issues.push({
      field: 'logicType',
      problem: logicCheck.reason,
      severity: 'high',
    });
  }

  /* ═══ BƯỚC 3 — Chạy tests ═══ */
  const testResult = runTests(tip);
  logger.debug(`Tests: allPass=${testResult.allPass}, cases=${testResult.results.length}`);

  if (!testResult.allPass) {
    const failed = testResult.results.filter((r) => !r.pass);
    issues.push({
      field: 'logicValue',
      problem: `Test fail: ${JSON.stringify(failed[0].input)} → kỳ vọng ${failed[0].expected}, nhận ${failed[0].got}`,
      severity: 'high',
    });
  }

  /* ═══ BƯỚC 4 — Nếu có issue → fail luôn, không cần gọi model ═══ */
  if (issues.length > 0) {
    logger.warn(`🧠 Não phải: ${issues.length} issue — fail luôn`);

    return {
      evaluation: {
        missingFields: [],
        reason: `Có ${issues.length} lỗi khi verify: pattern/logicType/tests`,
        numericTest: {
          example: '',
          calculation: '',
          expected: '',
          actual: '',
          match: false,
        },
        issues,
        suggestions: ['Sửa patterns/logicType/logicValue để pass verify'],
        needSupplement: false,
        needWebSearch: false,
        searchQuery: '',
        testsFailed: !testResult.allPass,
      },
      meta: {
        provider: 'local',
        testResult,
        patternCheck: { matched: patternCheck.matched },
        logicCheck,
      },
    };
  }

  /* ═══ BƯỚC 5 — Gọi Não phải verify ngữ nghĩa ═══ */
  const userMessage = naoPhaiPrompt.buildUserMessage({ tip, originalProblem });
  const messages = [
    { role: 'system', content: naoPhaiPrompt.SYSTEM_PROMPT },
    { role: 'user', content: userMessage },
  ];

  logger.info(`🧠 Não phải kiểm: "${tip.nguyenLy.slice(0, 60)}..."`);

  const { evaluation, meta } = await goiPhaiVaParse({
    owner, messages, tempKeys, label: '🧠 Não phải',
  });

  /* ═══ BƯỚC 6 — Web verify nếu cần ═══ */
  if (evaluation.needWebSearch && evaluation.searchQuery) {
    try {
      const searchResult = await webSearch(evaluation.searchQuery);
      const webText = formatForPrompt(searchResult);

      const messages2 = [
        { role: 'system', content: naoPhaiPrompt.SYSTEM_PROMPT },
        { role: 'user', content: userMessage },
        { role: 'assistant', content: JSON.stringify(evaluation) },
        { role: 'user', content: `🌐 WEB:\n${webText}\n\nKiểm lại TIP và trả JSON cuối.` },
      ];

      const { evaluation: evaluation2, meta: meta2 } = await goiPhaiVaParse({
        owner, messages: messages2, tempKeys, label: '🧠 Não phải (web)',
      });

      logger.success(
        `🧠 Não phải (web): missing=[${evaluation2.missingFields.join(',')}], ` +
        `patternMatch=${patternCheck.matched}, testsPass=${testResult.allPass}`
      );

      return {
        evaluation: evaluation2,
        meta: { ...meta2, webVerified: true, testResult, patternCheck, logicCheck },
      };
    } catch (err) {
      logger.warn(`Web verify lỗi: ${err.message}`);
    }
  }

  logger.success(
    `🧠 Não phải: missing=[${evaluation.missingFields.join(',')}], ` +
    `patternMatch=${patternCheck.matched}, testsPass=${testResult.allPass}`
  );

  return {
    evaluation,
    meta: { ...meta, testResult, patternCheck, logicCheck },
  };
}

module.exports = {
  kiemChung,
  parseJSONFromModel,
  normalizeEvaluation,
  runTests,
  verifyPattern,
  verifyLogicTypeForIntent,
};