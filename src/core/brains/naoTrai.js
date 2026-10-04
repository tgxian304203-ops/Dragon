/* ═══════════════════════════════════════════════════════════════
   🧠 NÃO TRÁI
   - Sinh TIP với cây JSON (100 rules)
   - [MỚI] Beautify code tự động — thêm \n nếu code dồn 1 dòng
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
const MAX_RULES = 500;
const MIN_RULES = 95;

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
   [MỚI] BEAUTIFY CODE — Thêm \n nếu code bị dồn 1 dòng
   ═══════════════════════════════════════════════════════════════ */

function beautifyCode(code) {
  if (typeof code !== 'string' || code.length < 50) return code;

  const lineCount = (code.match(/\n/g) || []).length;
  // Nếu code đã có ≥ 3 dòng → giữ nguyên
  if (lineCount >= 3) return code;

  const c = code;
  const len = c.length;
  if (len < 100) return code;

  let out = c;

  // 1. HTML/XML: xuống dòng trước mỗi thẻ mở/đóng
  // Thêm \n trước < nhưng không phải khi đã có \n
  out = out.replace(/([>])\s*(<)/g, '$1\n$2');

  // 2. Xuống dòng sau DOCTYPE
  out = out.replace(/(<!DOCTYPE[^>]+>)\s*(?=<)/gi, '$1\n');

  // 3. CSS/JS: xuống dòng sau `}` nếu chưa có
  out = out.replace(/\}\s*(?=\S)/g, '}\n');

  // 4. CSS: xuống dòng sau `;` khi trong block
  out = out.replace(/;\s*(?=[.#a-zA-Z@\[])/g, ';\n');

  // 5. JS: xuống dòng sau `;` khi đứng trước từ khóa
  out = out.replace(/;\s*(?=(const|let|var|function|return|if|for|while|console|document|window))/g, ';\n');

  // 6. Xuống dòng sau `{` của function/block
  out = out.replace(/\{\s*(?=\S)/g, '{\n');

  // 7. Dọn dẹp: bỏ dòng trắng liên tiếp
  out = out.replace(/\n{3,}/g, '\n\n');

  // 8. Trim từng dòng
  out = out.split('\n').map((line) => line.trimEnd()).join('\n');

  // 9. Trim tổng
  out = out.trim();

  return out;
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
   NORMALIZE
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
        // [MỚI] Beautify code
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
      .slice(0, MAX_RULES);
  }

  let fallback = { logicType: '', logicValue: '', outputTpl: 'Không xử lý được — cần sinh TIP mới' };
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

function normalizeTIP(raw) {
  const tip = {};
  for (const field of FIELDS_14) {
    const value = raw[field];
    if (field === 'quanHe') {
      tip[field] = Array.isArray(value)
        ? value.filter((v) => typeof v === 'string' && v.trim()).map((v) => unescapeNewlines(v.trim()))
        : [];
    } else {
      tip[field] = unescapeNewlines(typeof value === 'string' ? value.trim() : String(value || ''));
    }
  }

  let category = String(raw.category || '').toLowerCase().trim();
  if (!VALID_CATEGORIES.includes(category)) category = 'general';
  tip.category = category;

  tip.keywords = Array.isArray(raw.keywords)
    ? raw.keywords.filter((k) => typeof k === 'string' && k.trim().length >= 2).map((k) => k.trim().toLowerCase()).slice(0, 20)
    : [];

  tip.qualityScore = Number.isFinite(raw.qualityScore) ? Math.max(0, Math.min(100, Math.round(raw.qualityScore))) : 0;

  tip.patterns = Array.isArray(raw.patterns)
    ? raw.patterns.filter((p) => typeof p === 'string' && p.trim().length >= 3).map((p) => unescapeNewlines(p.trim())).slice(0, 15)
    : [];

  let logicType = String(raw.logicType || '').toLowerCase().trim();
  if (!VALID_LOGIC_TYPES.includes(logicType)) logicType = '';
  tip.logicType = logicType;

  let lv = unescapeNewlines(typeof raw.logicValue === 'string' ? raw.logicValue.trim() : '');
  // [MỚI] Beautify code
  if (logicType === 'code' || logicType === 'patch') {
    const before = lv.length;
    lv = beautifyCode(lv);
    if (lv.length !== before) {
      logger.debug(`✨ Beautify code: ${before} → ${lv.length} chars`);
    }
  }
  tip.logicValue = lv;

  tip.outputTpl = unescapeNewlines(typeof raw.outputTpl === 'string' ? raw.outputTpl.trim() : '');

  tip.tests = Array.isArray(raw.tests)
    ? raw.tests.filter((t) => t && typeof t === 'object' && t.input && t.expected !== undefined).slice(0, 10)
    : [];

  tip.cayQuyetDinhJson = normalizeCayQuyetDinhJson(raw.cayQuyetDinhJson);
  return tip;
}

/* ═══════════════════════════════════════════════════════════════
   GỌI MODEL + PARSE
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
      const tip = normalizeTIP(rawObj);

      if (!tip.nguyenLy || tip.nguyenLy.trim() === '') throw new Error('TIP thiếu nguyenLy');

      logger.success(
        `${label} xong (lần ${attempt}): ${result.provider}/${result.modelId} ` +
        `[${tip.category}] patterns=${tip.patterns.length}, logicType=${tip.logicType}, ` +
        `rules=${tip.cayQuyetDinhJson ? tip.cayQuyetDinhJson.rules.length : 0}, ` +
        `codeLines=${(tip.logicValue || '').split('\n').length}`
      );

      return { tip, meta: { provider: result.provider, modelId: result.modelId, keyId: result.keyId, usage: result.usage, attempts: attempt } };
    } catch (parseErr) {
      lastErr = parseErr;
      logger.warn(`${label} — parse JSON lỗi lần ${attempt}: ${parseErr.message}`);
      excludeModels.add(result.modelId);
    }
  }

  throw new Error(`${label} thất bại sau ${MAX_JSON_RETRY} lần. Lỗi cuối: ${lastErr?.message || 'unknown'}`);
}

async function phanTich({ problem, context = '', relatedTIPs = [], webResults = '', owner, tempKeys = null, intent = 'general', userProfile = null, intentHistory = [] }) {
  if (!problem || problem.trim() === '') throw new Error('Vấn đề rỗng');
  if (!owner || (!owner.userId && !owner.guestSessionId && !tempKeys)) throw new Error('Thiếu owner');

  const userMessage = naoTraiPrompt.buildUserMessage({
    problem: problem.trim(), context, relatedTIPs, webResults, userProfile, intentHistory,
  });

  const messages = [
    { role: 'system', content: naoTraiPrompt.SYSTEM_PROMPT },
    { role: 'user', content: userMessage },
  ];

  logger.info(`🧠 Não trái tạo TIP: "${problem.slice(0, 60)}..."`);

  try {
    return await goiVaParse({ side: 'left', owner, messages, tempKeys, label: '🧠 Não trái' });
  } catch (err) {
    feedback.recordHardProblem(problem, intent, err.message).catch((e) => logger.warn('feedback.recordHardProblem:', e.message));
    throw err;
  }
}

async function boSung({ tip, missingFields, problem, needCode = false, owner, tempKeys = null, intent = 'general', userProfile = null, intentHistory = [] }) {
  if (!tip || typeof tip !== 'object') throw new Error('TIP không hợp lệ');
  if (!Array.isArray(missingFields) || missingFields.length === 0) throw new Error('Không có trường cần bổ sung');

  const parts = [];
  parts.push(`📌 VẤN ĐỀ GỐC:\n${problem}`);

  if (userProfile) {
    parts.push(`\n👤 USER PROFILE:`);
    if (userProfile.preferredLang) parts.push(`- Ngôn ngữ ưa thích: ${userProfile.preferredLang}`);
    if (userProfile.preferredEditor) parts.push(`- Editor: ${userProfile.preferredEditor}`);
  }

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
  parts.push(`- cayQuyetDinhJson: ${JSON.stringify(tip.cayQuyetDinhJson || null)}`);
  parts.push(`\n⚠️ TRƯỜNG CẦN BỔ SUNG: ${missingFields.join(', ')}`);
  parts.push(`\n🎯 Trả JSON đầy đủ 14 trường + 4 trường máy + tests + cayQuyetDinhJson (100 rules).`);
  parts.push(`🚨 CODE PHẢI CÓ \\n XUỐNG DÒNG.`);
  parts.push(`\nCHỈ JSON.`);

  const messages = [
    { role: 'system', content: naoTraiPrompt.SYSTEM_PROMPT },
    { role: 'user', content: parts.join('\n') },
  ];

  logger.info(`🧠 Não trái bổ sung: [${missingFields.join(', ')}]`);

  try {
    return await goiVaParse({ side: 'left', owner, messages, tempKeys, label: '🧠 Não trái (bổ sung)' });
  } catch (err) {
    feedback.recordHardProblem(problem, intent, `bổ sung: ${err.message}`).catch((e) => logger.warn('feedback.recordHardProblem:', e.message));
    throw err;
  }
}

async function boSungCay({ tipCu, problem, owner, tempKeys = null, userProfile = null }) {
  if (!tipCu || typeof tipCu !== 'object') throw new Error('TIP cũ không hợp lệ');
  if (!problem || problem.trim() === '') throw new Error('Vấn đề rỗng');

  const cayCu = tipCu.cayQuyetDinhJson || { category: tipCu.category || 'general', rules: [], fallback: {} };

  const parts = [];
  parts.push(`📌 VẤN ĐỀ MỚI (chưa được cây cũ xử lý):\n${problem}`);

  if (userProfile) {
    parts.push(`\n👤 USER PROFILE:`);
    if (userProfile.preferredLang) parts.push(`- Ngôn ngữ ưa thích: ${userProfile.preferredLang}`);
    if (userProfile.preferredEditor) parts.push(`- Editor: ${userProfile.preferredEditor}`);
  }

  parts.push(`\n🌳 CÂY QUYẾT ĐỊNH HIỆN TẠI:`);
  parts.push(`- Category: ${cayCu.category}`);
  parts.push(`- Số rules hiện có: ${(cayCu.rules || []).length}`);
  parts.push(`- Rules hiện tại (50 đầu):`);
  (cayCu.rules || []).slice(0, 50).forEach((r, i) => {
    parts.push(`  [${i + 1}] if: ${r.if} → logicValue: ${(r.then?.logicValue || '').slice(0, 100)}`);
  });

  parts.push(`\n📚 TIP CŨ:`);
  parts.push(`- nguyenLy: ${tipCu.nguyenLy || ''}`);
  parts.push(`- category: ${tipCu.category || ''}`);
  parts.push(`- logicType: ${tipCu.logicType || ''}`);
  parts.push(`- patterns: ${(tipCu.patterns || []).slice(0, 5).join(' | ')}`);

  parts.push(`\n🎯 YÊU CẦU:`);
  parts.push(`- BỔ SUNG rules mới vào cây cũ để cover vấn đề mới`);
  parts.push(`- KHÔNG xóa rules cũ`);
  parts.push(`- KHÔNG sinh TIP mới — chỉ mở rộng cây`);
  parts.push(`- Trả JSON ĐẦY ĐỦ (14 trường + 4 trường máy + cayQuyetDinhJson)`);
  parts.push(`- cayQuyetDinhJson mới phải có TẤT CẢ rules cũ + 100 rules mới`);
  parts.push(`- 🚨 CODE PHẢI CÓ \\n XUỐNG DÒNG`);
  parts.push(`\nCHỈ JSON.`);

  const messages = [
    { role: 'system', content: naoTraiPrompt.SYSTEM_PROMPT },
    { role: 'user', content: parts.join('\n') },
  ];

  logger.info(`🧠 Não trái bổ sung cây — cây cũ có ${(cayCu.rules || []).length} rules`);

  return await goiVaParse({ side: 'left', owner, messages, tempKeys, label: '🧠 Não trái (bổ sung cây)' });
}

module.exports = {
  phanTich, boSung, boSungCay,
  parseJSONFromModel, normalizeTIP, normalizeCayQuyetDinhJson,
  sanitizeJsonText, unescapeNewlines, beautifyCode,
  FIELDS_14, VALID_CATEGORIES, VALID_LOGIC_TYPES, MAX_RULES, MIN_RULES,
};