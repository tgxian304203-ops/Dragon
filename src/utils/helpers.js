/* ═══════════════════════════════════════════════════════════════
   🛠️ HELPERS (UT3)
   ═══════════════════════════════════════════════════════════════ */

const crypto = require('crypto');

module.exports = {
  generateToken: (bytes = 24) => crypto.randomBytes(bytes).toString('base64url'),
  slugify: (text) => {
    if (typeof text !== 'string') return '';
    return text.toLowerCase().normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '')
      .slice(0, 100);
  },
  formatDate: (date) => {
    const d = new Date(date);
    const pad = (n) => String(n).padStart(2, '0');
    return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  },
};