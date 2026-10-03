/* ═══════════════════════════════════════════════════════════════
   🌐 WEB SEARCH — Tavily API (W1)
   - Thay DuckDuckGo (bị chặn IP Render/AWS/GCP)
   - Interface giữ nguyên: webSearch(query) → { query, results: [{title, url, snippet}] }
   ═══════════════════════════════════════════════════════════════ */

const {
  TAVILY_API_KEY,
  TAVILY_API_BASE,
  TAVILY_MAX_RESULTS,
  TAVILY_TIMEOUT_MS,
} = require('../config/constants');
const logger = require('../utils/logger');

const MAX_RESULTS = TAVILY_MAX_RESULTS;
const TIMEOUT_MS = TAVILY_TIMEOUT_MS;

async function webSearch(query) {
  if (typeof query !== 'string' || query.trim() === '') {
    throw new Error('Query không hợp lệ');
  }

  if (!TAVILY_API_KEY) {
    throw new Error('TAVILY_API_KEY chưa được cấu hình');
  }

  const q = query.trim();
  logger.debug(`Tavily search: "${q}"`);

  let response;
  try {
    response = await fetch(`${TAVILY_API_BASE}/search`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        api_key: TAVILY_API_KEY,
        query: q,
        max_results: MAX_RESULTS,
        search_depth: 'basic',
        include_answer: false,
        include_raw_content: false,
        include_images: false,
      }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (err) {
    if (err.name === 'TimeoutError' || err.name === 'AbortError') {
      logger.error(`Tavily timeout sau ${TIMEOUT_MS}ms`);
      throw new Error('Tavily timeout');
    }
    logger.error('Tavily fetch lỗi:', err.message);
    throw new Error(`Tavily lỗi kết nối: ${err.message}`);
  }

  if (!response.ok) {
    let bodyText = '';
    try {
      bodyText = await response.text();
    } catch (_) {
      bodyText = '(không đọc được body)';
    }
    logger.error(`Tavily HTTP ${response.status}: ${bodyText.slice(0, 300)}`);

    if (response.status === 401) {
      throw new Error('Tavily API key không hợp lệ hoặc đã bị xóa');
    }
    if (response.status === 429) {
      throw new Error('Tavily đã hết quota tháng này');
    }
    throw new Error(`Tavily HTTP ${response.status}`);
  }

  const raw = await response.json();

  if (!raw || !Array.isArray(raw.results)) {
    return { query: q, results: [] };
  }

  const results = raw.results
    .filter((r) => r.title && r.url)
    .slice(0, MAX_RESULTS)
    .map((r) => ({
      title: r.title || '',
      url: r.url || '',
      snippet: r.content || '',
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