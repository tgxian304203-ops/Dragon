/* ═══════════════════════════════════════════════════════════════
   🧠 NÃO PHẢI — Kiểm TIP + Xác minh Web khi cần (NP17)
   ═══════════════════════════════════════════════════════════════ */

const { callModel } = require('./goiModel');
const naoPhaiPrompt = require('./prompts/naoPhai.prompt');
const { FIELDS_14 } = require('./naoTrai');
const { webSearch, formatForPrompt } = require('../webSearch');
const logger = require('../../utils/logger');

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

async function kiemChung({ tip, originalProblem = '', owner }) {
  if (!tip || typeof tip !== 'object') throw new Error('TIP không hợp lệ');
  if (!tip.nguyenLy || tip.nguyenLy.trim() === '') throw new Error('TIP thiếu nguyenLy');
  if (!owner || (!owner.userId && !owner.guestSessionId)) throw new Error('Thiếu owner');

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
  });

  const rawObj = parseJSONFromModel(result.text);
  let evaluation = normalizeEvaluation(rawObj);

  if (evaluation.needWebSearch && evaluation.searchQuery) {
    logger.info(`🌐 Não phải yêu cầu xác minh Web: "${evaluation.searchQuery}"`);

    try {
      const searchResult = await webSearch(evaluation.searchQuery);
      const webText = formatForPrompt(searchResult);

      const messages2 = [
        { role: 'system', content: naoPhaiPrompt.SYSTEM_PROMPT },
        { role: 'user', content: userMessage },
        { role: 'assistant', content: result.text },
        { role: 'user', content: `🌐 KẾT QUẢ TÌM KIẾM ĐỂ XÁC MINH:\n${webText}\n\nHãy kiểm lại TIP với thông tin web trên và trả JSON cuối cùng (không cần needWebSearch nữa).` },
      ];

      const result2 = await callModel({
        side: 'right',
        userId: owner.userId,
        guestSessionId: owner.guestSessionId,
        messages: messages2,
        options: { temperature: 0.3, maxTokens: 2048 },
      });

      const rawObj2 = parseJSONFromModel(result2.text);
      evaluation = normalizeEvaluation(rawObj2);

      logger.success(`🌐 Não phải đã xác minh Web xong`);

      return {
        evaluation,
        meta: {
          provider: result2.provider,
          modelId: result2.modelId,
          keyId: result2.keyId,
          usage: result2.usage,
          webVerified: true,
        },
      };
    } catch (err) {
      logger.warn(`Não phải xác minh Web lỗi: ${err.message} → dùng kết quả gốc`);
    }
  }

  logger.success(
    `🧠 Não phải: missing=[${evaluation.missingFields.join(',')}], match=${evaluation.numericTest.match}`
  );

  return {
    evaluation,
    meta: {
      provider: result.provider,
      modelId: result.modelId,
      keyId: result.keyId,
      usage: result.usage,
    },
  };
}

module.exports = { kiemChung, parseJSONFromModel, normalizeEvaluation };