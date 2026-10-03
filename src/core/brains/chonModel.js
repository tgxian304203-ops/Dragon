/* ═══════════════════════════════════════════════════════════════
   🎯 CHỌN MODEL — chỉ còn sort priority + group (dùng cho UI)
   - Key-first đã chuyển logic chính sang goiModel.js
   ═══════════════════════════════════════════════════════════════ */

const { sortByPriority: sortPriorityBase } = require('./modelPriority');

/**
 * Sort model theo priority của provider.
 */
function sortByPriority(provider, models) {
  return sortPriorityBase(provider, models);
}

/**
 * Group key theo provider — dùng cho UI hiển thị.
 */
function groupKeysByProvider(keys) {
  const map = { gemini: [], groq: [], openrouter: [] };
  for (const key of keys) {
    if (map[key.provider]) map[key.provider].push(key);
  }
  return map;
}

module.exports = { sortByPriority, groupKeysByProvider };