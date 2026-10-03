/* ═══════════════════════════════════════════════════════════════
   🌐 BASE URL 3 PROVIDER + BẢNG ƯU TIÊN MODEL FREE
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

// Bảng ưu tiên model FREE
// Groq: ưu tiên llama-3.3-70b (ổn định, JSON mode tốt)
// gpt-oss-120b/20b xuống dưới vì hay lỗi JSON
const MODEL_PRIORITY = {
  gemini: [
    'gemini-3.8-flash',
    'gemini-3.7-flash',
    'gemini-3.1-flash-lite',
    'gemini-2.5-flash',
  ],
  groq: [
    'llama-3.3-70b-versatile',
    'llama-3.1-8b-instant',
    'openai/gpt-oss-120b',
    'openai/gpt-oss-20b',
    'moonshotai/kimi-k2-instruct',
    'qwen/qwen3.6-27b',
    'meta-llama/llama-4-scout-17b',
  ],
  openrouter: [
    'nvidia/nemotron-3-ultra:free',
    'poolside/laguna-s-2.1:free',
    'stealth/space-bunny-alpha:free',
    'inclusionai/ling-3.0-flash-fin:free',
    'google/gemma-4-26b-a4b-it:free',
  ],
};

// Whitelist model FREE của Gemini
const GEMINI_FREE_MODELS = new Set([
  'gemini-3.8-flash',
  'gemini-3.7-flash',
  'gemini-3.1-flash-lite',
  'gemini-2.5-flash',
  'gemini-2.5-flash-lite',
  'gemini-3.1-flash',
]);

module.exports = { PROVIDERS, MODEL_PRIORITY, GEMINI_FREE_MODELS };