/* ═══════════════════════════════════════════════════════════════
   🧠 NÃO TRÁI — Sinh nhánh cây gốc
   - Sinh nhánh mới khi cây thiếu
   - Nhận cha + mẹ (nếu con lai)
   - Kế thừa từ cha mẹ
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

const VALID_CATEGORIES = ['math', 'code', 'van', 'explain', 'general'];
const VALID_LOGIC_TYPES = ['expr', 'code', 'patch', ''];

const MAX_JSON_RETRY = 3;

/* ═══════════════════════════════════════════════════════════════
   UNESCAPE
   ═══════════════════════════════════════════════════════════════ */

function unescapeNewlines(str) {
  if (typeof str !== 'string') return '';
  return str
    .replace(/\\r\\n/g, '\n')
    .replace(/\\n/g, '\n')
    .replace(/\\r/g, '\r')
    .replace(/\\t/g, '\t')
    .replace(/\\"/g, '"')
    .replace(/\\'/g, "'")
    .replace(/\\\\/g, '\\');
}

/* ═══════════════════════════════════════════════════════════════
   BEAUTIFY CODE
   ═══════════════════════════════════════════════════════════════ */

function beautifyCode(code) {
  if (typeof code !== 'string' || code.length < 50) return code;
  const lineCount = (code.match(/\n/g) || []).length;
  if (lineCount >= 3) return code;
  if (code.length < 100) return code;

  let out = code;
  out = out.replace(/([>])\s*(<)/g, '$1\n$2');
  out = out.replace(/(<!DOCTYPE[^>]+>)\s*(?=<)/gi, '$1\n');
  out = out.replace(/\}\s*(?=\S)/g, '}\n');
  out = out.replace(/;\s*(?=[.#a-zA-Z@\[])/g, ';\n');
  out = out.replace(/;\s*(?=(const|let|var|function|return|if|for|while|console|document|window))/g, ';\n');
  out = out.replace(/\{\s*(?=\S)/g, '{\n');
  out = out.replace(/\n{3,}/g, '\n\n');
  out = out.split('\n').map((line) => line.trimEnd()).join('\n');
  return out.trim();
}

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
  logger.warn(`❌ Parse JSON fail. Raw: ${text.slice(0, 300)}`);
  throw new Error(`Không parse được JSON: ${lastErr?.message || 'unknown'}`);
}

/* ═══════════════════════════════════════════════════════════════
   NORMALIZE NHÁNH MỚI
   ═══════════════════════════════════════════════════════════════ */

function normalizeCayQuyetDinhJson(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;

  const category = String(raw.category || 'general').toLowerCase().trim();
  const validCat = VALID_CATEGORIES.includes(category) ? category : 'general';

  let rules = [];
  if (Array.isArray(raw.rules)) {
    rules = raw.rules
      .filter((r) => r && typeof r === 'object' && typeof r.if === 'string' && r.then && typeof r.then === 'object')
      .map((r) => {
        const then = r.then || {};
        const lt = String(then.logicType || '').toLowerCase().trim();
        let lv = unescapeNewlines(typeof then.logicValue === 'string' ? then.logicValue : '');
        if (lt === 'code' || lt === 'patch') lv = beautifyCode(lv);

        return {
          if: unescapeNewlines(String(r.if).trim()),
          then: {
            logicType: VALID_LOGIC_TYPES.includes(lt) ? lt : '',
            logicValue: lv,
            outputTpl: unescapeNewlines(typeof then.outputTpl === 'string' ? then.outputTpl : ''),
          },
        };
      })
      .slice(0, 500);
  }

  let fallback = { logicType: '', logicValue: '', outputTpl: 'Không xử lý được' };
  if (raw.fallback && typeof raw.fallback === 'object') {
    fallback = {
      logicType: String(raw.fallback.logicType || ''),
      logicValue: unescapeNewlines(typeof raw.fallback.logicValue === 'string' ? raw.fallback.logicValue : ''),
      outputTpl: unescapeNewlines(typeof raw.fallback.outputTpl === 'string' ? raw.fallback.outputTpl : 'Không xử lý được'),
    };
  }

  if (rules.length === 0) return null;
  return { category: validCat, rules, fallback };
}

/**
 * Chuẩn hóa nhánh mới do model sinh.
 */
function normalizeNhanh(raw, { id, parent, cha, me, depth }) {
  const nhanh = {};

  // Gen — ép cứng id, parent, cha, me, depth
  nhanh.id = id;
  nhanh.parent = parent || 'root';
  nhanh.cha = cha || null;
  nhanh.me = me || null;
  nhanh.depth = depth || 1;

  // Name
  nhanh.name = unescapeNewlines(typeof raw.name === 'string' ? raw.name.trim() : '');

  // 14 trường nội dung
  for (const field of FIELDS_14) {
    const value = raw[field];
    if (field === 'quanHe') {
      nhanh[field] = Array.isArray(value)
        ? value.filter((v) => typeof v === 'string' && v.trim()).map((v) => unescapeNewlines(v.trim()))
        : [];
    } else {
      nhanh[field] = unescapeNewlines(typeof value === 'string' ? value.trim() : String(value || ''));
    }
  }

  // Metadata
  let category = String(raw.category || '').toLowerCase().trim();
  if (!VALID_CATEGORIES.includes(category)) category = 'general';
  nhanh.category = category;

  nhanh.keywords = Array.isArray(raw.keywords)
    ? raw.keywords.filter((k) => typeof k === 'string' && k.trim().length >= 2).map((k) => k.trim().toLowerCase()).slice(0, 20)
    : [];

  nhanh.qualityScore = Number.isFinite(raw.qualityScore) ? Math.max(0, Math.min(100, Math.round(raw.qualityScore))) : 0;

  nhanh.patterns = Array.isArray(raw.patterns)
    ? raw.patterns.filter((p) => typeof p === 'string' && p.trim().length >= 3).map((p) => unescapeNewlines(p.trim())).slice(0, 15)
    : [];

  // 4 trường máy
  let logicType = String(raw.logicType || '').toLowerCase().trim();
  if (!VALID_LOGIC_TYPES.includes(logicType)) logicType = '';
  nhanh.logicType = logicType;

  let lv = unescapeNewlines(typeof raw.logicValue === 'string' ? raw.logicValue.trim() : '');
  if (logicType === 'code' || logicType === 'patch') {
    lv = beautifyCode(lv);
  }
  nhanh.logicValue = lv;

  nhanh.outputTpl = unescapeNewlines(typeof raw.outputTpl === 'string' ? raw.outputTpl.trim() : '');

  nhanh.tests = Array.isArray(raw.tests)
    ? raw.tests.filter((t) => t && typeof t === 'object' && t.input && t.expected !== undefined).slice(0, 10)
    : [];

  // Cây quyết định JSON
  nhanh.cayQuyetDinhJson = normalizeCayQuyetDinhJson(raw.cayQuyetDinhJson);

  // Con — rỗng khi mới sinh
  nhanh.children = [];

  // Feedback
  nhanh.usageCount = 0;
  nhanh.successCount = 0;
  nhanh.failCount = 0;
  nhanh.lastUsedAt = null;

  // Trạng thái
  nhanh.isActive = true;

  return nhanh;
}

/* ═══════════════════════════════════════════════════════════════
   GỌI MODEL
   ═══════════════════════════════════════════════════════════════ */

async function goiVaParse({ side, owner, messages, tempKeys, label, normalizeOptions }) {
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
        options: { temperature: 0.2, maxTokens: 8192, excludeModels: [...excludeModels], responseFormat: 'json' },
        tempKeys,
      });
    } catch (err) {
      lastErr = err;
      logger.error(`${label} — gọi model lỗi lần ${attempt}:`, err.message);
      continue;
    }

    try {
      const rawObj = parseJSONFromModel(result.text);
      const nhanh = normalizeNhanh(rawObj, normalizeOptions);

      if (!nhanh.nguyenLy || nhanh.nguyenLy.trim() === '') {
        throw new Error('Nhánh thiếu nguyenLy');
      }

      logger.success(
        `${label} xong (lần ${attempt}): ${result.provider}/${result.modelId} ` +
        `[${nhanh.category}] patterns=${nhanh.patterns.length}, logicType=${nhanh.logicType}, ` +
        `rules=${nhanh.cayQuyetDinhJson ? nhanh.cayQuyetDinhJson.rules.length : 0}, ` +
        `codeLines=${(nhanh.logicValue || '').split('\n').length}`
      );

      return { nhanh, meta: { provider: result.provider, modelId: result.modelId, keyId: result.keyId, usage: result.usage, attempts: attempt } };
    } catch (parseErr) {
      lastErr = parseErr;
      logger.warn(`${label} — parse JSON lỗi lần ${attempt}: ${parseErr.message}`);
      excludeModels.add(result.modelId);
    }
  }

  throw new Error(`${label} thất bại sau ${MAX_JSON_RETRY} lần. Lỗi cuối: ${lastErr?.message || 'unknown'}`);
}

/* ═══════════════════════════════════════════════════════════════
   HÀM CHÍNH — SINH NHÁNH MỚI
   ═══════════════════════════════════════════════════════════════ */

/**
 * Sinh 1 nhánh mới trong cây gốc.
 *
 * @param {Object} opts
 * @param {string} opts.id — id nhánh mới (VD "math.addition.multiply")
 * @param {string} opts.parent — parent id (VD "math.addition")
 * @param {string} opts.cha — cha ruột (thường = parent)
 * @param {string} opts.me — mẹ ruột (nếu con lai)
 * @param {number} opts.depth — độ sâu
 * @param {string} opts.problem — câu hỏi user
 * @param {Object} opts.chaNhanh — nhánh cha đầy đủ (để Não đọc gen)
 * @param {Object} opts.meNhanh — nhánh mẹ đầy đủ (nếu con lai)
 * @param {string} opts.context — ngữ cảnh
 * @param {Object} opts.userProfile — profile user
 */
async function sinhNhanhMoi({
  id, parent, cha = null, me = null, depth = 1,
  problem, chaNhanh = null, meNhanh = null,
  context = '', owner, tempKeys = null,
  userProfile = null, intentHistory = [],
}) {
  if (!id) throw new Error('Thiếu id nhánh mới');
  if (!problem || problem.trim() === '') throw new Error('Vấn đề rỗng');
  if (!owner || (!owner.userId && !owner.guestSessionId && !tempKeys)) throw new Error('Thiếu owner');

  const userMessage = naoTraiPrompt.buildUserMessage({
    problem: problem.trim(),
    context,
    id, parent, cha, me, depth,
    chaNhanh, meNhanh,
    userProfile,
    intentHistory,
  });

  const messages = [
    { role: 'system', content: naoTraiPrompt.SYSTEM_PROMPT },
    { role: 'user', content: userMessage },
  ];

  logger.info(`🧠 Não trái sinh nhánh "${id}" (parent=${parent}, cha=${cha || 'null'}, me=${me || 'null'})`);

  try {
    return await goiVaParse({
      side: 'left', owner, messages, tempKeys,
      label: '🧠 Não trái',
      normalizeOptions: { id, parent, cha, me, depth },
    });
  } catch (err) {
    feedback.recordHardProblem(problem, 'code', err.message).catch(() => {});
    throw err;
  }
}

/**
 * Bổ sung trường thiếu cho nhánh.
 */
async function boSungNhanh({ nhanh, missingFields, problem, owner, tempKeys = null, userProfile = null, intentHistory = [] }) {
  if (!nhanh || typeof nhanh !== 'object') throw new Error('Nhánh không hợp lệ');
  if (!Array.isArray(missingFields) || missingFields.length === 0) throw new Error('Không có trường cần bổ sung');

  const parts = [];
  parts.push(`📌 VẤN ĐỀ GỐC:\n${problem}`);
  parts.push(`\n🌳 NHÁNH HIỆN TẠI:`);
  parts.push(`- id: ${nhanh.id}`);
  parts.push(`- parent: ${nhanh.parent || '(rỗng)'}`);
  parts.push(`- cha: ${nhanh.cha || '(rỗng)'}`);
  parts.push(`- me: ${nhanh.me || '(rỗng)'}`);
  for (const field of FIELDS_14) {
    const v = nhanh[field];
    if (Array.isArray(v)) parts.push(`- ${field}: ${v.join(', ')}`);
    else parts.push(`- ${field}: ${v || '(TRỐNG)'}`);
  }
  parts.push(`- category: ${nhanh.category || '(TRỐNG)'}`);
  parts.push(`- patterns: ${(nhanh.patterns || []).join(' | ')}`);
  parts.push(`- logicType: ${nhanh.logicType || '(TRỐNG)'}`);
  parts.push(`- logicValue: ${nhanh.logicValue || '(TRỐNG)'}`);
  parts.push(`- outputTpl: ${nhanh.outputTpl || '(TRỐNG)'}`);
  parts.push(`- tests: ${JSON.stringify(nhanh.tests || [])}`);
  parts.push(`- cayQuyetDinhJson: ${JSON.stringify(nhanh.cayQuyetDinhJson || null)}`);
  parts.push(`\n⚠️ TRƯỜNG CẦN BỔ SUNG: ${missingFields.join(', ')}`);
  parts.push(`\n🎯 Trả JSON đầy đủ 14 trường + 4 trường máy + tests + cayQuyetDinhJson.`);
  parts.push(`🚨 CODE PHẢI CÓ \\n XUỐNG DÒNG.`);
  parts.push(`\nCHỈ JSON.`);

  const messages = [
    { role: 'system', content: naoTraiPrompt.SYSTEM_PROMPT },
    { role: 'user', content: parts.join('\n') },
  ];

  logger.info(`🧠 Não trái bổ sung nhánh "${nhanh.id}": [${missingFields.join(', ')}]`);

  try {
    return await goiVaParse({
      side: 'left', owner, messages, tempKeys,
      label: '🧠 Não trái (bổ sung)',
      normalizeOptions: { id: nhanh.id, parent: nhanh.parent, cha: nhanh.cha, me: nhanh.me, depth: nhanh.depth },
    });
  } catch (err) {
    feedback.recordHardProblem(problem, 'code', `bổ sung: ${err.message}`).catch(() => {});
    throw err;
  }
}

module.exports = {
  sinhNhanhMoi,
  boSungNhanh,
  parseJSONFromModel,
  normalizeNhanh,
  normalizeCayQuyetDinhJson,
  sanitizeJsonText,
  unescapeNewlines,
  beautifyCode,
  FIELDS_14,
  VALID_CATEGORIES,
  VALID_LOGIC_TYPES,
};