/* ═══════════════════════════════════════════════════════════════
   🏆 MODEL PRIORITY — Lọc rác + Sắp theo tier
   - Blocklist mở rộng (TTS, audio, guard, model nhỏ)
   - Whitelist cứng cho Groq — chỉ model chat sống
   - sortByTier: model tier 1 trước, tier 5 cuối
   ═══════════════════════════════════════════════════════════════ */

const {
  MODEL_PRIORITY,
  getTier,
} = require('../../config/providers');

/* ═══════════════════════════════════════════════════════════════
   BLOCKLIST — Model KHÔNG dùng được cho chat
   ═══════════════════════════════════════════════════════════════ */

const BLOCKED_PATTERNS = [
  // Speech / audio
  /whisper/i,
  /-tts/i,
  /tts-/i,
  /orpheus/i,
  /playai-tts/i,
  /-audio/i,
  /audio-/i,
  /realtime/i,
  /transcri/i,
  /speech/i,

  // Embedding / filter
  /embed/i,
  /-guard/i,
  /guard-/i,
  /prompt-guard/i,
  /safeguard/i,
  /moderation/i,

  // Vision-only
  /vision/i,

  // Model context ngắn / đã chết
  /allam-2-7b/i,
  /gemma2-9b-it/i,
  /llama-3\.3-70b/i,           // chết 16/08/26
  /kimi-k2/i,                   // chết 10/10/25
  /llama-4-maverick/i,          // chết 03/09/26
];

// Whitelist cứng cho Groq — CHỈ model Groq còn sống
const GROQ_CHAT_WHITELIST = [
  'openai/gpt-oss-120b',
  'openai/gpt-oss-20b',
  'qwen/qwen3.6-27b',
  'qwen/qwen3.8-27b',
];

/* ═══════════════════════════════════════════════════════════════
   HELPERS
   ═══════════════════════════════════════════════════════════════ */

function isBlocked(modelId) {
  if (!modelId || typeof modelId !== 'string') return true;
  return BLOCKED_PATTERNS.some((re) => re.test(modelId));
}

/**
 * Lọc cứng cho từng provider — bỏ model không phải chat.
 */
function filterProviderModels(provider, models) {
  let filtered = models.filter((m) => !isBlocked(m));

  if (provider === 'groq') {
    filtered = filtered.filter((m) => GROQ_CHAT_WHITELIST.includes(m));
  }

  return filtered;
}

function rankOf(provider, modelId) {
  const list = MODEL_PRIORITY[provider] || [];
  const idx = list.indexOf(modelId);
  return idx === -1 ? 9999 : idx;
}

function isInPriority(provider, modelId) {
  return (MODEL_PRIORITY[provider] || []).includes(modelId);
}

/* ═══════════════════════════════════════════════════════════════
   SORT — theo tier (chính) + rank trong provider (phụ)
   ═══════════════════════════════════════════════════════════════ */

/**
 * Sắp xếp model theo priority của provider (cách cũ).
 * Dùng cho UI hiển thị hoặc sort trong 1 provider.
 */
function sortByPriority(provider, models) {
  const allowed = filterProviderModels(provider, models);
  return [...allowed].sort((a, b) => rankOf(provider, a) - rankOf(provider, b));
}

/**
 * Sắp xếp model theo TIER xuyên provider.
 * - Tier 1 trước, tier 5 cuối
 * - Cùng tier → sort theo rank trong provider
 */
function sortByTier(provider, models) {
  const allowed = filterProviderModels(provider, models);

  return [...allowed].sort((a, b) => {
    const tierA = getTier(a);
    const tierB = getTier(b);
    if (tierA !== tierB) return tierA - tierB;

    // Cùng tier → sort theo rank trong provider
    return rankOf(provider, a) - rankOf(provider, b);
  });
}

module.exports = {
  rankOf,
  isInPriority,
  sortByPriority,
  sortByTier,
  isBlocked,
  filterProviderModels,
  GROQ_CHAT_WHITELIST,
};