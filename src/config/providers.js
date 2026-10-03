/* ═══════════════════════════════════════════════════════════════
   🌐 PROVIDERS + MODEL PRIORITY + TIER
   - Gemini 2.5-flash đã chết → xóa
   - Thêm gemini-3.5-flash-lite (thay thế 3.1 sẽ chết 2027)
   - Groq chỉ giữ model sống
   ═══════════════════════════════════════════════════════════════ */

const PROVIDERS = {
  gemini: {
    name: 'Gemini',
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta',
    modelsEndpoint: 'https://generativelanguage.googleapis.com/v1beta/models',
    authMode: 'query',
    authParam: 'key',
  },
  groq: {
    name: 'Groq',
    baseUrl: 'https://api.groq.com/openai/v1',
    modelsEndpoint: 'https://api.groq.com/openai/v1/models',
    authMode: 'header',
    authHeader: 'Authorization',
    authPrefix: 'Bearer ',
  },
  openrouter: {
    name: 'OpenRouter',
    baseUrl: 'https://openrouter.ai/api/v1',
    modelsEndpoint: 'https://openrouter.ai/api/v1/models',
    authMode: 'header',
    authHeader: 'Authorization',
    authPrefix: 'Bearer ',
  },
};

/* ═══════════════════════════════════════════════════════════════
   BẢNG ƯU TIÊN MODEL FREE — chỉ model CÒN SỐNG
   Gemini đã xóa:
     - gemini-2.5-flash (chết — no longer available to new users)
     - gemini-2.5-flash-lite (cùng đợt)
   Groq đã xóa:
     - llama-3.3-70b-versatile (chết 16/08/26)
     - moonshotai/kimi-k2-instruct (chết 10/10/25)
     - meta-llama/llama-4-maverick (chết 03/09/26)
     - meta-llama/llama-4-scout (không ổn định)
     - gemma2-9b-it (chết 10/08/25)
   ═══════════════════════════════════════════════════════════════ */

const MODEL_PRIORITY = {
  gemini: [
    'gemini-3.8-flash',
    'gemini-3.7-flash',
    'gemini-3.5-flash-lite',
    'gemini-3.1-flash-lite',
  ],
  groq: [
    'openai/gpt-oss-120b',
    'openai/gpt-oss-20b',
    'qwen/qwen3.6-27b',
    'qwen/qwen3.8-27b',
  ],
  openrouter: [
    'nvidia/nemotron-3-ultra:free',
    'poolside/laguna-s-2.1:free',
    'stealth/space-bunny-alpha:free',
    'inclusionai/ling-3.0-flash-fin:free',
    'google/gemma-4-26b-a4b-it:free',
  ],
};

/* ═══════════════════════════════════════════════════════════════
   TIER — Sức mạnh model xuyên provider
   Tier 1: mạnh nhất — dùng hết tier 1 xuyên provider trước
   Tier 2: mạnh nhì
   Tier 3: trung bình
   Tier 4: yếu
   ═══════════════════════════════════════════════════════════════ */

const MODEL_TIER = {
  // ═══ TIER 1 — Model mạnh nhất mỗi provider ═══
  'gemini-3.8-flash': 1,
  'openai/gpt-oss-120b': 1,
  'nvidia/nemotron-3-ultra:free': 1,

  // ═══ TIER 2 — Mạnh nhì ═══
  'gemini-3.7-flash': 2,
  'qwen/qwen3.6-27b': 2,
  'poolside/laguna-s-2.1:free': 2,

  // ═══ TIER 3 — Trung bình ═══
  'gemini-3.5-flash-lite': 3,
  'openai/gpt-oss-20b': 3,
  'qwen/qwen3.8-27b': 3,
  'stealth/space-bunny-alpha:free': 3,

  // ═══ TIER 4 — Yếu ═══
  'gemini-3.1-flash-lite': 4,
  'inclusionai/ling-3.0-flash-fin:free': 4,
  'google/gemma-4-26b-a4b-it:free': 4,
};

// Nếu model không có trong MODEL_TIER → coi như tier 5 (yếu nhất)
const DEFAULT_TIER = 5;

/* ═══════════════════════════════════════════════════════════════
   WHITELIST model FREE Gemini (chỉ model hỗ trợ generateContent)
   ═══════════════════════════════════════════════════════════════ */

const GEMINI_FREE_MODELS = new Set([
  'gemini-3.8-flash',
  'gemini-3.7-flash',
  'gemini-3.5-flash-lite',
  'gemini-3.1-flash-lite',
  'gemini-3.1-flash',
]);

/* ═══════════════════════════════════════════════════════════════
   HELPER — Lấy tier của model
   ═══════════════════════════════════════════════════════════════ */

function getTier(modelId) {
  if (!modelId) return DEFAULT_TIER;
  return MODEL_TIER[modelId] ?? DEFAULT_TIER;
}

/* ═══════════════════════════════════════════════════════════════
   EXPORTS
   ═══════════════════════════════════════════════════════════════ */

module.exports = {
  PROVIDERS,
  MODEL_PRIORITY,
  MODEL_TIER,
  DEFAULT_TIER,
  GEMINI_FREE_MODELS,
  getTier,
};