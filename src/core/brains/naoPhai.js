/* ═══════════════════════════════════════════════════════════════
   🧠 NÃO PHẢI — Kiểm TIP JSON + verify bằng machineEngine
   ═══════════════════════════════════════════════════════════════ */

const { callModel } = require('./goiModel');
const naoPhaiPrompt = require('./prompts/naoPhai.prompt');
const { webSearch, formatForPrompt } = require('../webSearch');
const { testTIP } = require('../machineEngine');
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

/**
 * Chuẩn hóa kết quả Não phải trả về
 */
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

  return {
    missingFields, reason, numericTest, issues, suggestions,
    needSupplement, needWebSearch, searchQuery,
  };
}

/**
 * Chạy machine engine test để kiểm TIP có hoạt động không
 */
function verifyByEngine(tip) {
  try {
    const r = testTIP(tip);
    return r;
  } catch (err) {
    logger.warn(`Engine verify lỗi: ${err.message}`);
    return { allPass: false, results: [], error: err.message };
  }
}

async function kiemChung({ tip, originalProblem = '', owner, tempKeys = null }) {
  if (!tip || typeof tip !== 'object') throw new Error('TIP không hợp lệ');
  if (!tip.nguyenLy) throw new Error('TIP thiếu nguyenLy');

  // ═══ BƯỚC 1: Chạy engine test trước ═══
  const engineResult = verifyByEngine(tip);
  logger.debug(`Engine test: allPass=${engineResult.allPass}, cases=${engineResult.results.length}`);

  // Nếu engine test fail → báo luôn, không cần gọi Não phải
  if (engineResult.results.length > 0 && !engineResult.allPass) {
    const failed = engineResult.results.filter((r) => !r.pass);
    logger.warn(`Engine test fail ${failed.length}/${engineResult.results.length} case`);

    const numericTest = {
      example: `Engine test: ${JSON.stringify(failed[0].input)}`,
      calculation: `Kỳ vọng ${failed[0].expected}, nhận ${failed[0].got}`,
      expected: String(failed[0].expected),
      actual: String(failed[0].got),
      match: false,
    };

    const issues = failed.map((f) => ({
      field: 'testCase',
      problem: `Input ${JSON.stringify(f.input)} → kỳ vọng ${f.expected}, nhận ${f.got}`,
      severity: 'high',
    }));

    return {
      evaluation: {
        missingFields: [],
        reason: 'Engine test case fail',
        numericTest,
        issues,
        suggestions: ['Sửa thuatToan/cayQuyetDinh để test case pass'],
        needSupplement: false,
        needWebSearch: false,
        searchQuery: '',
        engineFailed: true,
      },
      meta: { provider: 'engine', engineResult },
    };
  }

  // ═══ BƯỚC 2: Gọi Não phải kiểm schema ═══
  const userMessage = naoPhaiPrompt.buildUserMessage({ tip, originalProblem });

  const messages = [
    { role: 'system', content: naoPhaiPrompt.SYSTEM_PROMPT },
    { role: 'user', content: userMessage },
  ];

  logger.info(`🧠 Não phải kiểm: "${String(tip.nguyenLy).slice(0, 60)}..."`);

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

  // ═══ BƯỚC 3: Nếu Não phải yêu cầu tra Web ═══
  if (evaluation.needWebSearch && evaluation.searchQuery) {
    logger.info(`🌐 Não phải xác minh Web: "${evaluation.searchQuery}"`);

    try {
      const searchResult = await webSearch(evaluation.searchQuery);
      const webText = formatForPrompt(searchResult);

      const messages2 = [
        { role: 'system', content: naoPhaiPrompt.SYSTEM_PROMPT },
        { role: 'user', content: userMessage },
        { role: 'assistant', content: result.text },
        { role: 'user', content: `🌐 KẾT QUẢ TÌM KIẾM:\n${webText}\n\nKiểm lại TIP và trả JSON cuối.` },
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
          engineResult,
        },
      };
    } catch (err) {
      logger.warn(`Web verify lỗi: ${err.message} → dùng gốc`);
    }
  }

  logger.success(
    `🧠 Não phải: missing=[${evaluation.missingFields.join(',')}], ` +
    `match=${evaluation.numericTest.match}, enginePass=${engineResult.allPass}`
  );

  return {
    evaluation,
    meta: {
      provider: result.provider,
      modelId: result.modelId,
      keyId: result.keyId,
      usage: result.usage,
      engineResult,
    },
  };
}

module.exports = {
  kiemChung,
  parseJSONFromModel,
  normalizeEvaluation,
  verifyByEngine,
};