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

const MAX_JSON_RETRY = 3;

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
      results.push({ input: tc.input, expected: tc.expected, got, pass });
    } catch (err) {
      results.push({ input: tc.input, expected: tc.expected, got: null, pass: false, error: err.message });
    }
  }
  return { allPass: results.every((r) => r.pass), results };
}

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

async function kiemChung({ tip, originalProblem = '', owner, tempKeys = null }) {
  if (!tip || typeof tip !== 'object') throw new Error('TIP không hợp lệ');
  if (!tip.nguyenLy || tip.nguyenLy.trim() === '') throw new Error('TIP thiếu nguyenLy');
  if (!owner || (!owner.userId && !owner.guestSessionId && !tempKeys)) {
    throw new Error('Thiếu owner');
  }

  const testResult = runTests(tip);
  logger.debug(`Tests: allPass=${testResult.allPass}, cases=${testResult.results.length}`);

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

  const userMessage = naoPhaiPrompt.buildUserMessage({ tip, originalProblem });
  const messages = [
    { role: 'system', content: naoPhaiPrompt.SYSTEM_PROMPT },
    { role: 'user', content: userMessage },
  ];

  logger.info(`🧠 Não phải kiểm: "${tip.nguyenLy.slice(0, 60)}..."`);

  const { evaluation, meta } = await goiPhaiVaParse({
    owner, messages, tempKeys, label: '🧠 Não phải',
  });

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

      return { evaluation: evaluation2, meta: { ...meta2, webVerified: true, testResult } };
    } catch (err) {
      logger.warn(`Web verify lỗi: ${err.message}`);
    }
  }

  logger.success(
    `🧠 Não phải: missing=[${evaluation.missingFields.join(',')}], ` +
    `match=${evaluation.numericTest.match}, testsPass=${testResult.allPass}`
  );

  return { evaluation, meta: { ...meta, testResult } };
}

module.exports = { kiemChung, parseJSONFromModel, normalizeEvaluation, runTests };