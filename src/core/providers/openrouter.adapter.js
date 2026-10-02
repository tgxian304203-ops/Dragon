/* ═══════════════════════════════════════════════════════════════
   🌐 OPENROUTER ADAPTER — OpenAI-compatible
   ═══════════════════════════════════════════════════════════════ */

const { PROVIDERS } = require('../../config/providers');

const CFG = PROVIDERS.openrouter;
const TIMEOUT_MS = 30000;

async function fetchWithTimeout(url, options = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

function authHeaders(apiKey, extra = {}) {
  return {
    Authorization: `Bearer ${apiKey}`,
    'HTTP-Referer': 'https://rong-than.app',
    'X-Title': 'Rong Than',
    ...extra,
  };
}

async function listModels(apiKey) {
  const res = await fetchWithTimeout(CFG.modelsEndpoint, {
    method: 'GET',
    headers: authHeaders(apiKey),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    const err = new Error(`OpenRouter listModels ${res.status}: ${body.slice(0, 200)}`);
    err.status = res.status;
    throw err;
  }

  const data = await res.json();
  return (data.data || []).map((m) => m.id);
}

async function chat(apiKey, modelId, messages, options = {}) {
  const url = `${CFG.baseUrl}/chat/completions`;

  const res = await fetchWithTimeout(url, {
    method: 'POST',
    headers: authHeaders(apiKey, { 'Content-Type': 'application/json' }),
    body: JSON.stringify({
      model: modelId,
      messages,
      temperature: options.temperature ?? 0.7,
      max_tokens: options.maxTokens,
      stream: false,
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    const err = new Error(`OpenRouter chat ${res.status}: ${body.slice(0, 200)}`);
    err.status = res.status;
    throw err;
  }

  const data = await res.json();
  const text = data.choices?.[0]?.message?.content || '';

  const rateLimit = {
    limit: Number(res.headers.get('x-ratelimit-limit')) || null,
    remaining: Number(res.headers.get('x-ratelimit-remaining')) || null,
  };

  return { text, usage: data.usage || {}, rateLimit };
}

module.exports = { listModels, chat };