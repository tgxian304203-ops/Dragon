/* ═══════════════════════════════════════════════════════════════
   💾 MODEL CACHE — cache riêng left/right
   - TTL ngắn (10 phút) — tự dò lại model sống thường xuyên
   - Có cleanup tự động để không tràn RAM
   ═══════════════════════════════════════════════════════════════ */

// TTL cache model: 10 phút — đủ để giảm request API, đủ ngắn để phát hiện model chết
const MODEL_CACHE_TTL_MS = 10 * 60 * 1000;

// TTL blacklist model chết: 1 giờ — không thử lại model đã chết trong 1h
const DEAD_MODEL_TTL_MS = 60 * 60 * 1000;

const cacheLeft = new Map();
const cacheRight = new Map();

// Blacklist model chết — key: `${provider}::${modelId}` → expiresAt
const deadModels = new Map();

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
    expiresAt: Date.now() + MODEL_CACHE_TTL_MS,
  });
}

function clear(side, keyId) {
  getCache(side).delete(String(keyId));
}

function clearAll(side) {
  getCache(side).clear();
}

/* ═══════════════════════════════════════════════════════════════
   BLACKLIST MODEL CHẾT — dùng khi API trả 404 / decommissioned
   ═══════════════════════════════════════════════════════════════ */

/**
 * Đánh dấu model đã chết (404 / decommissioned).
 * Không thử lại trong 1 giờ.
 */
function markDead(provider, modelId) {
  if (!provider || !modelId) return;
  const key = `${provider}::${modelId}`;
  deadModels.set(key, Date.now() + DEAD_MODEL_TTL_MS);
}

/**
 * Kiểm tra model có bị đánh dấu chết không.
 */
function isDead(provider, modelId) {
  if (!provider || !modelId) return false;
  const key = `${provider}::${modelId}`;
  const expiresAt = deadModels.get(key);
  if (!expiresAt) return false;

  if (Date.now() > expiresAt) {
    deadModels.delete(key);
    return false;
  }
  return true;
}

/**
 * Cleanup — xóa các entry hết hạn để tránh tràn RAM.
 * Gọi định kỳ (mỗi 30 phút) từ server.
 */
function cleanup() {
  const now = Date.now();

  for (const cache of [cacheLeft, cacheRight]) {
    for (const [keyId, entry] of cache.entries()) {
      if (now > entry.expiresAt) cache.delete(keyId);
    }
  }

  for (const [key, expiresAt] of deadModels.entries()) {
    if (now > expiresAt) deadModels.delete(key);
  }
}

module.exports = {
  get,
  set,
  clear,
  clearAll,
  markDead,
  isDead,
  cleanup,
  MODEL_CACHE_TTL_MS,
  DEAD_MODEL_TTL_MS,
};