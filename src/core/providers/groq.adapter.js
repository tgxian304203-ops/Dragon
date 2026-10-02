/* ═══════════════════════════════════════════════════════════════
   🌐 GROQ ADAPTER — OpenAI-compatible
   - listModels + chat + transcribe (Whisper — VO9)
   ═══════════════════════════════════════════════════════════════ */

const { PROVIDERS } = require('../../config/providers');

const CFG = PROVIDERS.groq;
const TIMEOUT_MS = 30000;
const WHISPER_TIMEOUT_MS = 60000;

async function fetchWithTimeout(url, options = {}, timeout = TIMEOUT_MS) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

function authHeaders(apiKey, extra = {}) {
  return { Authorization: `Bearer ${apiKey}`, ...extra };
}

async function listModels(apiKey) {
  const res = await fetchWithTimeout(CFG.modelsEndpoint, {
    method: 'GET',
    headers: authHeaders(apiKey),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    const err = new Error(`Groq listModels ${res.status}: ${body.slice(0, 200)}`);
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
    const err = new Error(`Groq chat ${res.status}: ${body.slice(0, 200)}`);
    err.status = res.status;
    throw err;
  }

  const data = await res.json();
  const text = data.choices?.[0]?.message?.content || '';

  const rateLimit = {
    limitRequests: Number(res.headers.get('x-ratelimit-limit-requests')) || null,
    remainingRequests: Number(res.headers.get('x-ratelimit-remaining-requests')) || null,
    limitTokens: Number(res.headers.get('x-ratelimit-limit-tokens')) || null,
    remainingTokens: Number(res.headers.get('x-ratelimit-remaining-tokens')) || null,
  };

  return { text, usage: data.usage || {}, rateLimit };
}

async function transcribe(apiKey, audioBuffer, filename = 'voice.webm') {
  const url = `${CFG.baseUrl}/audio/transcriptions`;

  const formData = new FormData();
  const blob = new Blob([audioBuffer]);
  formData.append('file', blob, filename);
  formData.append('model', 'whisper-large-v3');

  const res = await fetchWithTimeout(url, {
    method: 'POST',
    headers: authHeaders(apiKey),
    body: formData,
  }, WHISPER_TIMEOUT_MS);

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    const err = new Error(`Groq Whisper ${res.status}: ${body.slice(0, 200)}`);
    err.status = res.status;
    throw err;
  }

  const data = await res.json();
  return { text: data.text || '' };
}

module.exports = { listModels, chat, transcribe };