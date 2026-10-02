/* ═══════════════════════════════════════════════════════════════
   📝 LOGGER — Ghi log có màu (UT1)
   ═══════════════════════════════════════════════════════════════ */

const C = {
  reset: '\x1b[0m', gray: '\x1b[90m', red: '\x1b[31m',
  green: '\x1b[32m', yellow: '\x1b[33m', magenta: '\x1b[35m',
  cyan: '\x1b[36m',
};

function ts() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

module.exports = {
  info:    (...a) => console.log(`${C.gray}[${ts()}]${C.reset} ${C.cyan}ℹ️  INFO${C.reset}`, ...a),
  success: (...a) => console.log(`${C.gray}[${ts()}]${C.reset} ${C.green}✅ OK  ${C.reset}`, ...a),
  warn:    (...a) => console.warn(`${C.gray}[${ts()}]${C.reset} ${C.yellow}⚠️  WARN${C.reset}`, ...a),
  error:   (...a) => console.error(`${C.gray}[${ts()}]${C.reset} ${C.red}❌ ERR ${C.reset}`, ...a),
  debug:   (...a) => {
    if (process.env.NODE_ENV !== 'production') {
      console.log(`${C.gray}[${ts()}]${C.reset} ${C.magenta}🐛 DBG ${C.reset}`, ...a);
    }
  },
};