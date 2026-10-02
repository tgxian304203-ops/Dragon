/* ═══════════════════════════════════════════════════════════════
   🎤 VOICE CACHE — RAM tạm (VO5, VO6)
   ═══════════════════════════════════════════════════════════════ */

const { VOICE_TTL_MS, MAX_VOICES_PER_USER } = require('../config/constants');

const store = new Map();
let cleanupTimer = null;

function getOwnerKey(userId, guestSessionId) {
  if (userId) return `u:${userId}`;
  if (guestSessionId) return `g:${guestSessionId}`;
  throw new Error('Thiếu owner');
}

function getUserStore(ownerKey) {
  if (!store.has(ownerKey)) store.set(ownerKey, new Map());
  return store.get(ownerKey);
}

function set(userId, guestSessionId, voiceId, buffer, mimeType = 'audio/webm') {
  const ownerKey = getOwnerKey(userId, guestSessionId);
  const userStore = getUserStore(ownerKey);

  if (userStore.size >= MAX_VOICES_PER_USER) {
    const oldestKey = userStore.keys().next().value;
    userStore.delete(oldestKey);
  }

  userStore.set(voiceId, {
    buffer, mimeType,
    expiresAt: Date.now() + VOICE_TTL_MS,
  });

  return voiceId;
}

function get(userId, guestSessionId, voiceId) {
  const ownerKey = getOwnerKey(userId, guestSessionId);
  const userStore = store.get(ownerKey);
  if (!userStore) return null;

  const entry = userStore.get(voiceId);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    userStore.delete(voiceId);
    return null;
  }
  return entry;
}

function remove(userId, guestSessionId, voiceId) {
  const ownerKey = getOwnerKey(userId, guestSessionId);
  const userStore = store.get(ownerKey);
  if (userStore) userStore.delete(voiceId);
}

function cleanup() {
  const now = Date.now();
  for (const [ownerKey, userStore] of store.entries()) {
    for (const [id, entry] of userStore.entries()) {
      if (now > entry.expiresAt) userStore.delete(id);
    }
    if (userStore.size === 0) store.delete(ownerKey);
  }
}

function startCleanup() {
  if (cleanupTimer) return;
  cleanupTimer = setInterval(cleanup, 60 * 1000);
}

function stopCleanup() {
  if (cleanupTimer) { clearInterval(cleanupTimer); cleanupTimer = null; }
}

module.exports = { set, get, remove, startCleanup, stopCleanup };