/* ═══════════════════════════════════════════════════════════════
   📁 FILE CACHE — RAM tạm (FL3, FL4, FL5)
   ═══════════════════════════════════════════════════════════════ */

const { FILE_TTL_MS, RAM_THRESHOLD_BYTES } = require('../config/constants');
const logger = require('../utils/logger');

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

function isRAMOk() {
  return process.memoryUsage().heapUsed < RAM_THRESHOLD_BYTES;
}

function set(userId, guestSessionId, fileId, buffer, meta = {}) {
  if (!isRAMOk()) {
    const err = new Error('Hệ thống đang bận, vui lòng thử lại sau ít phút');
    err.status = 503;
    throw err;
  }

  const ownerKey = getOwnerKey(userId, guestSessionId);
  const userStore = getUserStore(ownerKey);

  userStore.set(fileId, {
    buffer,
    fileName: meta.fileName || '',
    fileType: meta.fileType || '',
    mimeType: meta.mimeType || 'application/octet-stream',
    expiresAt: Date.now() + FILE_TTL_MS,
  });

  return fileId;
}

function get(userId, guestSessionId, fileId) {
  const ownerKey = getOwnerKey(userId, guestSessionId);
  const userStore = store.get(ownerKey);
  if (!userStore) return null;

  const entry = userStore.get(fileId);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    userStore.delete(fileId);
    return null;
  }
  return entry;
}

function remove(userId, guestSessionId, fileId) {
  const ownerKey = getOwnerKey(userId, guestSessionId);
  const userStore = store.get(ownerKey);
  if (userStore) userStore.delete(fileId);
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

module.exports = { set, get, remove, isRAMOk, startCleanup, stopCleanup };