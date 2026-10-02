/* ═══════════════════════════════════════════════════════════════
   🌐 WEB SEARCH — DuckDuckGo (W1)
   ═══════════════════════════════════════════════════════════════ */

const { search, SafeSearchType } = require('duck-duck-scrape');
const logger = require('../utils/logger');

const MAX_RESULTS = 5;
const TIMEOUT_MS = 15000;

async function webSearch(query) {
  if (typeof query !== 'string' || query.trim() === '') {
    throw new Error('Query không hợp lệ');
  }

  const q = query.trim();
  logger.debug(`DDG search: "${q}"`);

  const searchPromise = search(q, { safeSearch: SafeSearchType.MODERATE });
  const timeoutPromise = new Promise((_, reject) =>
    setTimeout(() => reject(new Error('DuckDuckGo timeout')), TIMEOUT_MS)
  );

  const raw = await Promise.race([searchPromise, timeoutPromise]);

  if (!raw || !Array.isArray(raw.results)) {
    return { query: q, results: [] };
  }

  const results = raw.results
    .filter((r) => r.title && r.url)
    .slice(0, MAX_RESULTS)
    .map((r) => ({
      title: r.title || '',
      url: r.url || '',
      snippet: r.description || r.snippet || '',
    }));

  return { query: q, results };
}

function formatForPrompt(searchResult) {
  if (!searchResult || !searchResult.results || searchResult.results.length === 0) {
    return `Không tìm thấy kết quả cho: "${searchResult?.query || ''}"`;
  }

  const lines = [`Kết quả cho: "${searchResult.query}"\n`];
  searchResult.results.forEach((r, i) => {
    lines.push(`${i + 1}. ${r.title}`);
    lines.push(`   URL: ${r.url}`);
    if (r.snippet) lines.push(`   ${r.snippet}`);
    lines.push('');
  });
  return lines.join('\n');
}

module.exports = { webSearch, formatForPrompt };