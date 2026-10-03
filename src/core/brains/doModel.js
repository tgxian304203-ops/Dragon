/* ═══════════════════════════════════════════════════════════════
   📋 DO MODEL — Dò model SỐNG từ API provider
   - Gọi adapter.listModels() → lấy danh sách thật
   - Lọc free + whitelist + blocklist
   - Sắp theo tier xuyên provider
   ═══════════════════════════════════════════════════════════════ */

const gemini = require('../providers/gemini.adapter');
const groq = require('../providers/groq.adapter');
const openrouter = require('../providers/openrouter.adapter');
const {
  GEMINI_FREE_MODELS,
  getTier,
} = require('../../config/providers');
const { isBlocked } = require('./modelPriority');
const logger = require('../../utils/logger');

const ADAPTERS = { gemini, groq, openrouter };

/* ═══════════════════════════════════════════════════════════════
   WHITELIST GROQ — chỉ model Groq còn sống
   ═══════════════════════════════════════════════════════════════ */

const GROQ_ALIVE_MODELS = new Set([
  'openai/gpt-oss-120b',
  'openai/gpt-oss-20b',
  'qwen/qwen3.6-27b',
  'qwen/qwen3.8-27b',
]);

/* ═══════════════════════════════════════════════════════════════
   FILTER — lọc model theo provider
   ═══════════════════════════════════════════════════════════════ */

function filterFreeModels(provider, models) {
  let filtered = models.filter((m) => !isBlocked(m));

  if (provider === 'gemini') {
    filtered = filtered.filter((m) => GEMINI_FREE_MODELS.has(m));
  } else if (provider === 'groq') {
    // Groq: chỉ giữ model có trong whitelist sống
    filtered = filtered.filter((m) => GROQ_ALIVE_MODELS.has(m));
  } else if (provider === 'openrouter') {
    // OpenRouter: chỉ giữ model :free
    filtered = filtered.filter((m) => m.endsWith(':free'));
  }

  return filtered;
}

/* ═══════════════════════════════════════════════════════════════
   SORT — sắp theo tier + tên (để ổn định)
   ═══════════════════════════════════════════════════════════════ */

function sortByTier(models) {
  return [...models].sort((a, b) => {
    const tierA = getTier(a);
    const tierB = getTier(b);
    if (tierA !== tierB) return tierA - tierB;
    // Cùng tier → sort alphabet để ổn định
    return String(a).localeCompare(String(b));
  });
}

/* ═══════════════════════════════════════════════════════════════
   MAIN — dò model từ provider
   ═══════════════════════════════════════════════════════════════ */

async function doModel(provider, apiKey) {
  const adapter = ADAPTERS[provider];
  if (!adapter) throw new Error(`Provider ${provider} không hỗ trợ`);

  if (!apiKey || typeof apiKey !== 'string') {
    throw new Error(`Provider ${provider}: apiKey không hợp lệ`);
  }

  let raw;
  try {
    raw = await adapter.listModels(apiKey);
  } catch (err) {
    logger.warn(`doModel ${provider} — listModels lỗi: ${err.message}`);
    throw err;
  }

  if (!Array.isArray(raw)) {
    throw new Error(`Provider ${provider}: listModels trả về không phải array`);
  }

  const rawCount = raw.length;

  const freeOnly = filterFreeModels(provider, raw);
  const sorted = sortByTier(freeOnly);

  logger.debug(
    `${provider}: ${rawCount} thô → ${freeOnly.length} sống+sạch → ${sorted.length} sau sort tier`
  );

  if (sorted.length > 0) {
    logger.debug(
      `${provider} models (theo tier): ` +
      sorted.slice(0, 5).map((m) => `${m}(T${getTier(m)})`).join(', ')
    );
  }

  return {
    models: sorted,
    count: sorted.length,
    rawCount,
  };
}

module.exports = {
  doModel,
  filterFreeModels,
  sortByTier,
  GROQ_ALIVE_MODELS,
};