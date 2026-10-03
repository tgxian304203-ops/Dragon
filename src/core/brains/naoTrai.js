/* ═══════════════════════════════════════════════════════════════
   🧠 NÃO TRÁI — Tạo TIP 14 trường + 4 trường máy
   ═══════════════════════════════════════════════════════════════ */

const { callModel } = require('./goiModel');
const naoTraiPrompt = require('./prompts/naoTrai.prompt');
const logger = require('../../utils/logger');

const FIELDS_14 = [
  'nguyenLy', 'quyTac', 'dieuKien', 'cayQuyetDinh',
  'phuongPhap', 'thuatToan', 'workflow', 'suyLuan',
  'testCase', 'kiemChung', 'ngoaiLe', 'caseKinhNghiem',
  'quanHe', 'nguonPhienBan',
];

const VALID_CATEGORIES = ['math', 'code', 'bugfix', 'explain', 'general'];
const VALID_LOGIC_TYPES = ['expr', 'code', 'patch', ''];

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

function normalizeTIP(raw) {
  const tip = {};

  // 14 trường text
  for (const field of FIELDS_14) {
    const value = raw[field];
    if (field === 'quanHe') {
      tip[field] = Array.isArray(value)
        ? value.filter((v) => typeof v === 'string' && v.trim())
        : [];
    } else {
      tip[field] = typeof value === 'string' ? value.trim() : String(value || '');
    }
  }

  // Metadata
  let category = String(raw.category || '').toLowerCase().trim();
  if (!VALID_CATEGORIES.includes(category)) category = 'general';
  tip.category = category;

  tip.keywords = Array.isArray(raw.keywords)
    ? raw.keywords
        .filter((k) => typeof k === 'string' && k.trim().length >= 2)
        .map((k) => k.trim().toLowerCase())
        .slice(0, 20)
    : [];

  tip.qualityScore = Number.isFinite(raw.qualityScore)
    ? Math.max(0, Math.min(100, Math.round(raw.qualityScore)))
    : 0;

  // 4 trường máy
  tip.patterns = Array.isArray(raw.patterns)
    ? raw.patterns
        .filter((p) => typeof p === 'string' && p.trim().length >= 3)
        .map((p) => p.trim())
        .slice(0, 10)
    : [];

  let logicType = String(raw.logicType || '').toLowerCase().trim();
  if (!VALID_LOGIC_TYPES.includes(logicType)) logicType = '';
  tip.logicType = logicType;

  tip.logicValue = typeof raw.logicValue === 'string' ? raw.logicValue.trim() : '';
  tip.outputTpl = typeof raw.outputTpl === 'string' ? raw.outputTpl.trim() : '';

  // tests
  tip.tests = Array.isArray(raw.tests)
    ? raw.tests
        .filter((t) => t && typeof t === 'object' && t.input && t.expected !== undefined)
        .slice(0, 10)
    : [];

  return tip;
}

async function phanTich({ problem, context = '', relatedTIPs = [], webResults = '', owner, tempKeys = null }) {
  if (!problem || problem.trim() === '') throw new Error('Vấn đề rỗng');
  if (!owner || (!owner.userId && !owner.guestSessionId && !tempKeys)) {
    throw new Error('Thiếu owner');
  }

  const userMessage = naoTraiPrompt.buildUserMessage({
    problem: problem.trim(), context, relatedTIPs, webResults,
  });

  const messages = [
    { role: 'system', content: naoTraiPrompt.SYSTEM_PROMPT },
    { role: 'user', content: userMessage },
  ];

  logger.info(`🧠 Não trái tạo TIP: "${problem.slice(0, 60)}..."`);

  const result = await callModel({
    side: 'left',
    userId: owner.userId,
    guestSessionId: owner.guestSessionId,
    messages,
    options: { temperature: 0.3, maxTokens: 4096 },
    tempKeys,
  });

  const rawObj = parseJSONFromModel(result.text);
  const tip = normalizeTIP(rawObj);

  if (!tip.nguyenLy || tip.nguyenLy.trim() === '') {
    throw new Error('Não trái: TIP thiếu nguyenLy');
  }

  logger.success(
    `🧠 Não trái xong: ${result.provider}/${result.modelId} [${tip.category}] ` +
    `patterns=${tip.patterns.length}, logicType=${tip.logicType}, tests=${tip.tests.length}`
  );

  return {
    tip,
    meta: { provider: result.provider, modelId: result.modelId, keyId: result.keyId, usage: result.usage },
  };
}

async function boSung({ tip, missingFields, problem, needCode = false, owner, tempKeys = null }) {
  if (!tip || typeof tip !== 'object') throw new Error('TIP không hợp lệ');
  if (!Array.isArray(missingFields) || missingFields.length === 0) {
    throw new Error('Không có trường cần bổ sung');
  }

  const parts = [];
  parts.push(`📌 VẤN ĐỀ GỐC:\n${problem}`);
  parts.push(`\n📦 TIP HIỆN TẠI:`);
  for (const field of FIELDS_14) {
    const v = tip[field];
    if (Array.isArray(v)) parts.push(`- ${field}: ${v.join(', ')}`);
    else parts.push(`- ${field}: ${v || '(TRỐNG)'}`);
  }
  parts.push(`- category: ${tip.category || '(TRỐNG)'}`);
  parts.push(`- patterns: ${(tip.patterns || []).join(' | ')}`);
  parts.push(`- logicType: ${tip.logicType || '(TRỐNG)'}`);
  parts.push(`- logicValue: ${tip.logicValue || '(TRỐNG)'}`);
  parts.push(`- outputTpl: ${tip.outputTpl || '(TRỐNG)'}`);
  parts.push(`- tests: ${JSON.stringify(tip.tests || [])}`);

  parts.push(`\n⚠️ TRƯỜNG CẦN BỔ SUNG: ${missingFields.join(', ')}`);
  parts.push(`\n🎯 Trả JSON đầy đủ 14 trường + 4 trường máy + tests.`);
  parts.push(`\nChỉ trả JSON, không markdown.`);

  const messages = [
    { role: 'system', content: naoTraiPrompt.SYSTEM_PROMPT },
    { role: 'user', content: parts.join('\n') },
  ];

  logger.info(`🧠 Não trái bổ sung: [${missingFields.join(', ')}]`);

  const result = await callModel({
    side: 'left',
    userId: owner.userId,
    guestSessionId: owner.guestSessionId,
    messages,
    options: { temperature: 0.3, maxTokens: 4096 },
    tempKeys,
  });

  const rawObj = parseJSONFromModel(result.text);
  const newTip = normalizeTIP(rawObj);

  if (!newTip.nguyenLy || newTip.nguyenLy.trim() === '') {
    throw new Error('Não trái bổ sung: vẫn thiếu nguyenLy');
  }

  return {
    tip: newTip,
    meta: { provider: result.provider, modelId: result.modelId, keyId: result.keyId, usage: result.usage },
  };
}

module.exports = {
  phanTich, boSung, parseJSONFromModel, normalizeTIP,
  FIELDS_14, VALID_CATEGORIES, VALID_LOGIC_TYPES,
};