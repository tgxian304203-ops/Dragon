/* ═══════════════════════════════════════════════════════════════
   🧠 NÃO PHẢI — Kiểm TIP + chạy tests verify
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

function parseJSONFromModel(raw) {
  if (!raw || typeof raw !== 'string') throw new Error('Output rỗng');

  let text = raw.trim();
  const block = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  if (block) text = block[1].trim();

  try {
    return JSON.parse(text);
  } catch {
    const first = text.indexOf('{');
    const last = text.lastIndexOf('}');
    if (first !== -1 && last > first) {
      try { return JSON.parse(text.slice(first, last + 1)); } catch (err) {
        throw new Error(`Không parse được JSON: ${err.message}`);
      }
    }
    throw new Error('Không tìm thấy JSON');
  }
}

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

  const needSupplement = missingFields.length > 0;

  return { missingFields, reason, numericTest, issues, suggestions, needSupplement, needWebSearch, searchQuery };
}

/**
 * Chạy thử tests — verify logicValue có đúng không
 */
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
        const num = Number(v);
        scope[k] = Number.isNaN(num) ? v : num;
      }

      const got = evaluate(tip.logicValue, scope);
      const pass = got == tc.expected;

      results.push({
        input: tc.input,
        expected: tc.expected,
        got,
        pass,
      });
    } catch (err) {
      results.push({
        input: tc.input,
        expected: tc.expected,
        got: null,
        pass: false,
        error: err.message,
      });
    }
  }

  return {
    allPass: results.every((r) => r.pass),
    results,
  };
}

async function kiemChung({ tip, originalProblem = '', owner, tempKeys = null }) {
  if (!tip || typeof tip !== 'object') throw new Error('TIP không hợp lệ');
  if (!tip.nguyenLy || tip.nguyenLy.trim() === '') throw new Error('TIP thiếu nguyenLy');
  if (!owner || (!owner.userId && !owner.guestSessionId && !tempKeys)) {
    throw new Error('Thiếu owner');
  }

  // ═══ Chạy tests trước ═══
  const testResult = runTests(tip);
  logger.debug(`Tests: allPass=${testResult.allPass}, cases=${testResult.results.length}`);

  // Nếu tests fail → trả về luôn, không cần gọi Não phải
  if (!testResult.allPass) {
    const failed = testResult.results.filter((r) => !r.pass);

    return {
      evaluation: {
        missingFields: [],
        reason: 'Tests fail',
        numericTest: {
          example: JSON.stringify(failed[0].input),
          calculation: `Kỳ vọng ${failed[0].expected}, nhận ${failed[0].got}`,
          expected: String(failed[0].expected),
          actual: String(failed[0].got),
          match: false,
        },
        issues: failed.map((f) => ({
          field: 'logicValue',
          problem: `Test ${JSON.stringify(f.input)} → kỳ vọng ${f.expected}, nhận ${f.got}`,
          severity: 'high',
        })),
        suggestions: ['Sửa logicValue để test pass'],
        needSupplement: false,
        needWebSearch: false,
        searchQuery: '',
        testsFailed: true,
      },
      meta: { provider: 'local', testResult },
    };
  }

  // ═══ Gọi Não phải kiểm bằng model ═══
  const userMessage = naoPhaiPrompt.buildUserMessage({ tip, originalProblem });

  const messages = [
    { role: 'system', content: naoPhaiPrompt.SYSTEM_PROMPT },
    { role: 'user', content: userMessage },
  ];

  logger.info(`🧠 Não phải kiểm: "${tip.nguyenLy.slice(0, 60)}..."`);

  const result = await callModel({
    side: 'right',
    userId: owner.userId,
    guestSessionId: owner.guestSessionId,
    messages,
    options: { temperature: 0.3, maxTokens: 2048 },
    tempKeys,
  });

  const rawObj = parseJSONFromModel(result.text);
  let evaluation = normalizeEvaluation(rawObj);

  // Web verify
  if (evaluation.needWebSearch && evaluation.searchQuery) {
    try {
      const searchResult = await webSearch(evaluation.searchQuery);
      const webText = formatForPrompt(searchResult);

      const messages2 = [
        { role: 'system', content: naoPhaiPrompt.SYSTEM_PROMPT },
        { role: 'user', content: userMessage },
        { role: 'assistant', content: result.text },
        { role: 'user', content: `🌐 WEB:\n${webText}\n\nKiểm lại TIP và trả JSON cuối.` },
      ];

      const result2 = await callModel({
        side: 'right',
        userId: owner.userId,
        guestSessionId: owner.guestSessionId,
        messages: messages2,
        options: { temperature: 0.3, maxTokens: 2048 },
        tempKeys,
      });

      const rawObj2 = parseJSONFromModel(result2.text);
      evaluation = normalizeEvaluation(rawObj2);

      return {
        evaluation,
        meta: {
          provider: result2.provider,
          modelId: result2.modelId,
          keyId: result2.keyId,
          usage: result2.usage,
          webVerified: true,
          testResult,
        },
      };
    } catch (err) {
      logger.warn(`Web verify lỗi: ${err.message}`);
    }
  }

  logger.success(
    `🧠 Não phải: missing=[${evaluation.missingFields.join(',')}], ` +
    `match=${evaluation.numericTest.match}, testsPass=${testResult.allPass}`
  );

  return {
    evaluation,
    meta: {
      provider: result.provider,
      modelId: result.modelId,
      keyId: result.keyId,
      usage: result.usage,
      testResult,
    },
  };
}

module.exports = { kiemChung, parseJSONFromModel, normalizeEvaluation, runTests };