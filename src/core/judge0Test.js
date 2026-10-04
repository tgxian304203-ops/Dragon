/* ═══════════════════════════════════════════════════════════════
   🧪 JUDGE0 TEST — Sandbox chạy code miễn phí (thay Piston)
   - Giữ nguyên interface: testCode({ code, language, stdin, filename })
   - Trả về: { success, stdout, stderr, output, exitCode, error }
   ═══════════════════════════════════════════════════════════════ */

const { JUDGE0_API_URL, JUDGE0_TIMEOUT_MS } = require('../config/constants');
const logger = require('../utils/logger');

const TIMEOUT_MS = JUDGE0_TIMEOUT_MS;

// Bảng ánh xạ ngôn ngữ → language_id của Judge0 CE
const LANG_MAP = {
  python: { language_id: 71, name: 'Python (3.8.1)' },
  python3: { language_id: 71, name: 'Python (3.8.1)' },
  py: { language_id: 71, name: 'Python (3.8.1)' },
  javascript: { language_id: 63, name: 'JavaScript (Node.js 12.14.0)' },
  js: { language_id: 63, name: 'JavaScript (Node.js 12.14.0)' },
  node: { language_id: 63, name: 'JavaScript (Node.js 12.14.0)' },
  typescript: { language_id: 74, name: 'TypeScript (3.7.4)' },
  ts: { language_id: 74, name: 'TypeScript (3.7.4)' },
  java: { language_id: 62, name: 'Java (OpenJDK 13.0.1)' },
  c: { language_id: 48, name: 'C (GCC 7.4.0)' },
  cpp: { language_id: 54, name: 'C++ (GCC 9.2.0)' },
  'c++': { language_id: 54, name: 'C++ (GCC 9.2.0)' },
  go: { language_id: 60, name: 'Go (1.13.5)' },
  rust: { language_id: 73, name: 'Rust (1.40.0)' },
  ruby: { language_id: 72, name: 'Ruby (2.7.0)' },
  php: { language_id: 68, name: 'PHP (7.4.1)' },
  bash: { language_id: 46, name: 'Bash (5.0.0)' },
  sh: { language_id: 46, name: 'Bash (5.0.0)' },
};

function normalizeLang(lang) {
  if (!lang) return LANG_MAP.python;
  const key = String(lang).toLowerCase().trim();
  return LANG_MAP[key] || LANG_MAP.python;
}

/**
 * Chạy code qua Judge0 CE.
 */
async function testCode({ code, language = 'python', stdin = '', filename = '' }) {
  if (!code || code.trim() === '') {
    throw new Error('Judge0: code không hợp lệ');
  }

  const langCfg = normalizeLang(language);

  const payload = {
    language_id: langCfg.language_id,
    source_code: Buffer.from(code, 'utf-8').toString('base64'),
    stdin: Buffer.from(stdin || '', 'utf-8').toString('base64'),
  };

  logger.debug(`🧪 Judge0: ${langCfg.name}`);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const url = `${JUDGE0_API_URL}/submissions?base64_encoded=true&wait=true`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    if (!res.ok) {
      const body = await res.text().catch(() => '');
      logger.warn(`Judge0 HTTP ${res.status}: ${body.slice(0, 200)}`);
      return {
        success: false,
        stdout: '',
        stderr: '',
        output: '',
        exitCode: null,
        error: `Judge0 HTTP ${res.status}: ${body.slice(0, 200)}`,
      };
    }

    const data = await res.json();

    const decode = (s) => {
      if (!s) return '';
      try {
        return Buffer.from(s, 'base64').toString('utf-8');
      } catch {
        return '';
      }
    };

    const stdout = decode(data.stdout);
    const stderr = decode(data.stderr);
    const compileOutput = decode(data.compile_output);
    const message = decode(data.message);

    const statusId = data.status?.id ?? null;
    const statusDesc = data.status?.description || '';

    const success =
      statusId === 3 &&
      (!stderr || stderr.trim() === '') &&
      (!compileOutput || compileOutput.trim() === '');

    const output = stdout || stderr || compileOutput || message || '';
    const errorText = success
      ? null
      : stderr || compileOutput || message || statusDesc || `Status ${statusId}`;

    logger.debug(`🧪 Judge0 xong: status=${statusId} (${statusDesc})`);

    return {
      success,
      stdout,
      stderr: stderr || compileOutput,
      output,
      exitCode: statusId === 3 ? 0 : statusId,
      error: errorText,
      time: data.time || null,
      memory: data.memory || null,
    };
  } catch (err) {
    if (err.name === 'AbortError') {
      logger.error(`Judge0 timeout sau ${TIMEOUT_MS}ms`);
      return {
        success: false,
        stdout: '',
        stderr: '',
        output: '',
        exitCode: null,
        error: 'Judge0 timeout',
      };
    }
    logger.error('Judge0 test lỗi:', err.message);
    return {
      success: false,
      stdout: '',
      stderr: '',
      output: '',
      exitCode: null,
      error: err.message,
    };
  } finally {
    clearTimeout(timer);
  }
}

module.exports = { testCode, normalizeLang, LANG_MAP };