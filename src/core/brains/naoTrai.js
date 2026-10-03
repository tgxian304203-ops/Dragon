/* ═══════════════════════════════════════════════════════════════
   🧠 NÃO TRÁI — Tạo TIP 14 trường + 4 trường máy
   - JSON mode + retry blacklist model
   - Sanitize JSON mạnh — bắt mọi dạng output model
   - [MỚI] Ghi feedback.recordHardProblem khi fail 3 lần
   ═══════════════════════════════════════════════════════════════ */

const { callModel } = require('./goiModel');
const naoTraiPrompt = require('./prompts/naoTrai.prompt');
const feedback = require('./feedback');
const logger = require('../../utils/logger');

const FIELDS_14 = [
  'nguyenLy', 'quyTac', 'dieuKien', 'cayQuyetDinh',
  'phuongPhap', 'thuatToan', 'workflow', 'suyLuan',
  'testCase', 'kiemChung', 'ngoaiLe', 'caseKinhNghiem',
  'quanHe', 'nguonPhienBan',
];

const VALID_CATEGORIES = ['math', 'code', 'bugfix', 'explain', 'general'];
const VALID_LOGIC_TYPES = ['expr', 'code', 'patch', ''];

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
  if (first !== -1 && last > first) {
    s = s.slice(first, last + 1);
  }

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
    try {
      return JSON.parse(cand);
    } catch (err) {
      lastErr = err;
    }
  }

  logger.warn(`❌ Parse JSON fail. Raw (300 ký tự đầu): ${text.slice(0, 300)}`);
  throw new Error(`Không parse được JSON: ${lastErr?.message || 'unknown'}`);
}

/* ═══════════════════════════════════════════════════════════════
   NORMALIZE TIP
   ═══════════════════════════════════════════════════════════════ */

function normalizeTIP(raw) {
  const tip = {};

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

  tip.tests = Array.isArray(raw.tests)
    ? raw.tests
        .filter((t) => t && typeof t === 'object' && t.input && t.expected !== undefined)
        .slice(0, 10)
    : [];

  return tip;
}

/* ═══════════════════════════════════════════════════════════════
   GỌI MODEL + PARSE JSON
   ═══════════════════════════════════════════════════════════════ */

async function goiVaParse({ side, owner, messages, tempKeys, label }) {
  const excludeModels = new Set();
  let lastErr = null;

  for (let attempt = 1; attempt <= MAX_JSON_RETRY; attempt++) {
    let result;
    try {
      result = await callModel({
        side,
        userId: owner.userId,
        guestSessionId: owner.guestSessionId,
        messages,
        options: {
          temperature: 0.2,
          maxTokens: 4096,
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
      const tip = normalizeTIP(rawObj);

      if (!tip.nguyenLy || tip.nguyenLy.trim() === '') {
        throw new Error('TIP thiếu nguyenLy');
      }

      logger.success(
        `${label} xong (lần ${attempt}): ${result.provider}/${result.modelId} ` +
        `[${tip.category}] patterns=${tip.patterns.length}, logicType=${tip.logicType}`
      );

      return {
        tip,
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
      logger.warn(
        `${label} — parse JSON lỗi lần ${attempt} ` +
        `(model ${result.provider}/${result.modelId}): ${parseErr.message}`
      );
      excludeModels.add(result.modelId);
    }
  }

  throw new Error(
    `${label} thất bại sau ${MAX_JSON_RETRY} lần. Lỗi cuối: ${lastErr?.message || 'unknown'}`
  );
}

/* ═══════════════════════════════════════════════════════════════
   PHÂN TÍCH — tạo TIP mới
   ═══════════════════════════════════════════════════════════════ */

async function phanTich({ problem, context = '', relatedTIPs = [], webResults = '', owner, tempKeys = null, intent = 'general' }) {
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

  try {
    return await goiVaParse({
      side: 'left', owner, messages, tempKeys, label: '🧠 Não trái',
    });
  } catch (err) {
    // [MỚI] Ghi log câu hỏi khó (bất đồng bộ)
    feedback.recordHardProblem(problem, intent, err.message)
      .catch((e) => logger.warn('feedback.recordHardProblem:', e.message));
    throw err;
  }
}

/* ═══════════════════════════════════════════════════════════════
   BỔ SUNG — Não trái bổ sung trường thiếu
   ═══════════════════════════════════════════════════════════════ */

async function boSung({ tip, missingFields, problem, needCode = false, owner, tempKeys = null, intent = 'general' }) {
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
  parts.push(`\nCHỈ trả JSON, KHÔNG có text trước hoặc sau.`);

  const messages = [
    { role: 'system', content: naoTraiPrompt.SYSTEM_PROMPT },
    { role: 'user', content: parts.join('\n') },
  ];

  logger.info(`🧠 Não trái bổ sung: [${missingFields.join(', ')}]`);

  try {
    return await goiVaParse({
      side: 'left', owner, messages, tempKeys, label: '🧠 Não trái (bổ sung)',
    });
  } catch (err) {
    // [MỚI] Ghi log câu hỏi khó (bất đồng bộ)
    feedback.recordHardProblem(problem, intent, `bổ sung: ${err.message}`)
      .catch((e) => logger.warn('feedback.recordHardProblem:', e.message));
    throw err;
  }
}

module.exports = {
  phanTich, boSung, parseJSONFromModel, normalizeTIP,
  sanitizeJsonText,
  FIELDS_14, VALID_CATEGORIES, VALID_LOGIC_TYPES,
};