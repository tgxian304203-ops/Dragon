/* ═══════════════════════════════════════════════════════════════
   💾 MODEL CACHE (TU5) — cache riêng left/right
   ═══════════════════════════════════════════════════════════════ */

const { MODEL_UPDATE_INTERVAL_MS } = require('../../config/constants');

const cacheLeft = new Map();
const cacheRight = new Map();

function getCache(side) {
  return side === 'left' ? cacheLeft : cacheRight;
}

function get(side, keyId) {
  const cache = getCache(side);
  const entry = cache.get(String(keyId));
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    cache.delete(String(keyId));
    return null;
  }
  return entry.models;
}

function set(side, keyId, models) {
  const cache = getCache(side);
  cache.set(String(keyId), {
    models: [...models],
    expiresAt: Date.now() + MODEL_UPDATE_INTERVAL_MS,
  });
}

function clear(side, keyId) {
  getCache(side).delete(String(keyId));
}

function clearAll(side) {
  getCache(side).clear();
}

module.exports = { get, set, clear, clearAll };