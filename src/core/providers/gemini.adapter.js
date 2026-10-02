/* ═══════════════════════════════════════════════════════════════
   🌐 GEMINI ADAPTER
   - Auth: ?key=API_KEY trong URL
   - listModels + chat + readImage + readFile
   ═══════════════════════════════════════════════════════════════ */

const { PROVIDERS } = require('../../config/providers');

const CFG = PROVIDERS.gemini;
const TIMEOUT_MS = 30000;
const FILE_TIMEOUT_MS = 90000;

async function fetchWithTimeout(url, options = {}, timeout = TIMEOUT_MS) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function listModels(apiKey) {
  const url = `${CFG.modelsEndpoint}?key=${encodeURIComponent(apiKey)}`;
  const res = await fetchWithTimeout(url, { method: 'GET' });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    const err = new Error(`Gemini listModels ${res.status}: ${body.slice(0, 200)}`);
    err.status = res.status;
    throw err;
  }

  const data = await res.json();
  return (data.models || [])
    .filter((m) => (m.supportedGenerationMethods || []).includes('generateContent'))
    .map((m) => m.name.replace(/^models\//, ''));
}

async function chat(apiKey, modelId, messages, options = {}) {
  const url = `${CFG.baseUrl}/models/${encodeURIComponent(modelId)}:generateContent?key=${encodeURIComponent(apiKey)}`;

  const contents = messages.map((m) => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: m.content }],
  }));

  const res = await fetchWithTimeout(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents,
      generationConfig: {
        temperature: options.temperature ?? 0.7,
        maxOutputTokens: options.maxTokens,
      },
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    const err = new Error(`Gemini chat ${res.status}: ${body.slice(0, 200)}`);
    err.status = res.status;
    throw err;
  }

  const data = await res.json();
  const candidate = data.candidates?.[0];
  const text = candidate?.content?.parts?.map((p) => p.text).join('') || '';

  return { text, usage: data.usageMetadata || {} };
}

async function readImage(apiKey, modelId, imageBuffer, mimeType = 'image/jpeg') {
  const url = `${CFG.baseUrl}/models/${encodeURIComponent(modelId)}:generateContent?key=${encodeURIComponent(apiKey)}`;
  const base64 = imageBuffer.toString('base64');

  const payload = {
    contents: [{
      role: 'user',
      parts: [
        { text: 'Hãy mô tả chi tiết nội dung ảnh này bằng tiếng Việt. Nếu có chữ, đọc luôn. Trả lời ngắn gọn, đúng trọng tâm.' },
        { inlineData: { mimeType, data: base64 } },
      ],
    }],
    generationConfig: { temperature: 0.3, maxOutputTokens: 2048 },
  };

  const res = await fetchWithTimeout(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  }, FILE_TIMEOUT_MS);

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    const err = new Error(`Gemini readImage ${res.status}: ${body.slice(0, 200)}`);
    err.status = res.status;
    throw err;
  }

  const data = await res.json();
  return data.candidates?.[0]?.content?.parts?.map((p) => p.text).join('') || '';
}

async function readFile(apiKey, modelId, fileBuffer, mimeType) {
  const url = `${CFG.baseUrl}/models/${encodeURIComponent(modelId)}:generateContent?key=${encodeURIComponent(apiKey)}`;
  const base64 = fileBuffer.toString('base64');

  const payload = {
    contents: [{
      role: 'user',
      parts: [
        { text: 'Hãy đọc và trích xuất toàn bộ nội dung text của file này. Nếu là PDF scan, đọc chữ trong ảnh. Trả về text thuần, không thêm giải thích.' },
        { inlineData: { mimeType: mimeType || 'application/octet-stream', data: base64 } },
      ],
    }],
    generationConfig: { temperature: 0.1, maxOutputTokens: 8192 },
  };

  const res = await fetchWithTimeout(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  }, FILE_TIMEOUT_MS);

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    const err = new Error(`Gemini readFile ${res.status}: ${body.slice(0, 200)}`);
    err.status = res.status;
    throw err;
  }

  const data = await res.json();
  return data.candidates?.[0]?.content?.parts?.map((p) => p.text).join('') || '';
}

module.exports = { listModels, chat, readImage, readFile };