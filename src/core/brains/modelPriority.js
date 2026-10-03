/* ═══════════════════════════════════════════════════════════════
   🏆 MODEL PRIORITY — sắp xếp + lọc model rác
   ═══════════════════════════════════════════════════════════════ */

const { MODEL_PRIORITY } = require('../../config/providers');

/**
 * Model KHÔNG dùng được cho chat — auto block.
 * Bao gồm: speech-to-text, text-to-speech, embedding,
 * guard, safeguard, vision-only, audio, realtime.
 */
const BLOCKED_PATTERNS = [
  /whisper/i,       // speech-to-text
  /-tts/i,          // text-to-speech
  /tts-/i,
  /embed/i,         // embedding
  /-guard/i,        // prompt guard
  /guard-/i,
  /safeguard/i,     // safeguard filter
  /vision/i,        // vision-only
  /-audio/i,        // audio
  /audio-/i,
  /realtime/i,      // realtime
  /transcri/i,      // transcribe
  /moderation/i,    // moderation
];

function isBlocked(modelId) {
  if (!modelId || typeof modelId !== 'string') return true;
  return BLOCKED_PATTERNS.some((re) => re.test(modelId));
}

function rankOf(provider, modelId) {
  const list = MODEL_PRIORITY[provider] || [];
  const idx = list.indexOf(modelId);
  return idx === -1 ? 9999 : idx;
}

function isInPriority(provider, modelId) {
  return (MODEL_PRIORITY[provider] || []).includes(modelId);
}

/**
 * Sắp xếp model theo priority + LỌC model rác.
 * Model không có trong list vẫn được giữ (rank 9999) nhưng đã lọc rác.
 */
function sortByPriority(provider, models) {
  const allowed = models.filter((m) => !isBlocked(m));
  return [...allowed].sort((a, b) => rankOf(provider, a) - rankOf(provider, b));
}

module.exports = { rankOf, isInPriority, sortByPriority, isBlocked };