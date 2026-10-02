/* ═══════════════════════════════════════════════════════════════
   🧪 PISTON TEST (H5)
   ═══════════════════════════════════════════════════════════════ */

const { PISTON_URL } = require('../config/constants');
const logger = require('../utils/logger');

const TIMEOUT_MS = 30000;

const LANG_MAP = {
  python: { language: 'python', version: '3.10.0' },
  python3: { language: 'python', version: '3.10.0' },
  py: { language: 'python', version: '3.10.0' },
  javascript: { language: 'javascript', version: '18.15.0' },
  js: { language: 'javascript', version: '18.15.0' },
  node: { language: 'javascript', version: '18.15.0' },
  typescript: { language: 'typescript', version: '5.0.3' },
  ts: { language: 'typescript', version: '5.0.3' },
  java: { language: 'java', version: '15.0.2' },
  c: { language: 'c', version: '10.2.0' },
  cpp: { language: 'c++', version: '10.2.0' },
  'c++': { language: 'c++', version: '10.2.0' },
  go: { language: 'go', version: '1.16.2' },
  rust: { language: 'rust', version: '1.68.2' },
  ruby: { language: 'ruby', version: '3.0.1' },
  php: { language: 'php', version: '8.2.3' },
  bash: { language: 'bash', version: '5.2.0' },
  sh: { language: 'bash', version: '5.2.0' },
};

function normalizeLang(lang) {
  if (!lang) return LANG_MAP.python;
  const key = String(lang).toLowerCase().trim();
  return LANG_MAP[key] || LANG_MAP.python;
}

async function testCode({ code, language = 'python', stdin = '', filename = '' }) {
  if (!code || code.trim() === '') {
    throw new Error('Piston: code không hợp lệ');
  }

  const langCfg = normalizeLang(language);
  const fname = filename || defaultFilename(langCfg.language);

  const payload = {
    language: langCfg.language,
    version: langCfg.version,
    files: [{ name: fname, content: code }],
    stdin: stdin || '',
    compile_timeout: 10000,
    run_timeout: 15000,
  };

  logger.debug(`🧪 Piston: ${langCfg.language} ${langCfg.version}`);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const res = await fetch(`${PISTON_URL}/execute`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    if (!res.ok) {
      const body = await res.text().catch(() => '');
      logger.warn(`Piston HTTP ${res.status}: ${body.slice(0, 200)}`);
      return {
        success: false,
        stdout: '',
        stderr: '',
        output: '',
        exitCode: null,
        error: `Piston HTTP ${res.status}: ${body.slice(0, 200)}`,
      };
    }

    const data = await res.json();

    const run = data.run || {};
    const compile = data.compile || {};

    const stdout = run.stdout || '';
    const stderr = run.stderr || '';
    const compileStderr = compile.stderr || '';
    const exitCode = run.code ?? null;

    const success = exitCode === 0 &&
                    (!stderr || stderr.trim() === '') &&
                    (!compileStderr || compileStderr.trim() === '');

    const output = stdout || stderr || compileStderr || '';

    return {
      success,
      stdout,
      stderr: stderr || compileStderr,
      output,
      exitCode,
      error: success ? null : (stderr || compileStderr || `Exit code ${exitCode}`),
    };
  } catch (err) {
    logger.error('Piston test lỗi:', err.message);
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

function defaultFilename(language) {
  const map = {
    python: 'main.py', javascript: 'main.js', typescript: 'main.ts',
    java: 'Main.java', c: 'main.c', 'c++': 'main.cpp',
    go: 'main.go', rust: 'main.rs', ruby: 'main.rb',
    php: 'main.php', bash: 'main.sh',
  };
  return map[language] || 'main.txt';
}

module.exports = { testCode, normalizeLang, LANG_MAP };