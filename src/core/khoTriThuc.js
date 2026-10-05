/* ═══════════════════════════════════════════════════════════════
   📚 KHO TRI THỨC — Helper functions
   - KHÔNG còn search TIP
   - Chỉ giữ detectIntent, detectLangCan, kiemNgonNguKhop
   ═══════════════════════════════════════════════════════════════ */

const { fuzzyEqual } = require('./logicRunner');
const logger = require('../utils/logger');

const SYNONYM_MAP = {
  'sửa': ['fix', 'debug', 'sửa lỗi', 'khắc phục', 'sua'],
  'fix': ['sửa', 'debug', 'sửa lỗi', 'bugfix'],
  'debug': ['sửa', 'fix', 'gỡ lỗi'],
  'lỗi': ['bug', 'error', 'sai', 'hỏng', 'loi'],
  'bug': ['lỗi', 'error', 'sai'],
  'viết': ['tạo', 'code', 'lập trình', 'xây dựng', 'viet'],
  'code': ['viết code', 'lập trình', 'script', 'program', 'hàm'],
  'tạo': ['viết', 'xây dựng', 'lập', 'tao'],
  'hàm': ['function', 'method', 'ham'],
  'tính': ['toán', 'tính toán', 'giải', 'kết quả', 'tinh'],
  'toán': ['tính', 'tính toán', 'phép tính', 'toan', 'math'],
  'cộng': ['tổng', 'addition', 'sum', '+', 'cộng lại', 'plus', 'cong', 'add'],
  'trừ': ['hiệu', 'subtraction', '-', 'trừ đi', 'bớt', 'minus', 'tru'],
  'nhân': ['tích', 'multiplication', '*', 'x', '×', 'nhân với', 'times', 'nhan'],
  'chia': ['thương', 'division', '/', 'chia cho', 'divide'],
  'tổng': ['cộng', 'sum', 'tong'],
  'hiệu': ['trừ', 'difference', 'hieu'],
  'tích': ['nhân', 'product', 'tich'],
  'thương': ['chia', 'quotient', 'thuong'],
  'mũ': ['lũy thừa', 'power', '^', 'exponent'],
  'web': ['trang web', 'website', 'html', 'shop', 'landing', 'spck'],
  'shop': ['cửa hàng', 'bán hàng', 'web bán', 'html shop'],
  'html': ['web', 'trang web', 'website', 'css', 'js', 'spck'],
  'spck': ['html', 'web', 'trang web', 'app điện thoại'],
  'thơ': ['poem', 'lục bát', 'thất ngôn'],
  'văn': ['văn học', 'văn xuôi', 'tả', 'kể'],
};

const STOP_WORDS = new Set([
  'là', 'của', 'và', 'có', 'không', 'được', 'cho', 'với', 'thì', 'mà',
  'này', 'kia', 'đó', 'tôi', 'mình', 'bạn', 'em', 'anh', 'chị',
  'gì', 'sao', 'nào', 'đâu', 'khi', 'thế', 'ạ', 'à', 'nhé', 'nha',
  'the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'to', 'of', 'in',
  'muốn', 'cần', 'giúp', 'giùm', 'làm', 'hay', 'hoặc',
  'bằng', 'mấy', 'bao', 'nhiêu', 'vậy', 'ra',
  'tính', 'hộ', 'dùm', 'giùm',
]);

/* ═══════════════════════════════════════════════════════════════
   DETECT
   ═══════════════════════════════════════════════════════════════ */

function detectIntent(query) {
  const q = query.toLowerCase();
  if (/\b(sửa|fix|debug|lỗi|bug|error|sai|hỏng|khắc phục|gỡ lỗi|sua)\b/i.test(q)) return 'bugfix';
  if (/\b(viết|tạo|code|lập trình|hàm|function|script|chương trình|xây dựng|viet|tao|ham)\b/i.test(q)) return 'code';
  if (/\b(tính|toán|phép|cộng|trừ|nhân|chia|tổng|hiệu|tích|thương|mũ|giải phương trình|[+\-*/=^]|tinh|cong|tru|nhan)\b/i.test(q)) return 'math';
  if (/\b(giải thích|tại sao|vì sao|là gì|khái niệm|định nghĩa|như thế nào|lý do|nguyên nhân)\b/i.test(q)) return 'explain';
  return 'general';
}

function detectLangCan(query) {
  const q = String(query).toLowerCase();
  if (/\b(spck|html|web|shop|trang web|trang|landing|css|giao diện|\bui\b|frontend|front-end|website|cửa hàng|bán hàng)\b/.test(q)) return 'html';
  if (/\bpython\b|\bpy\b/.test(q)) return 'python';
  if (/\bjavascript\b|\bjs\b|\bnode\b|express/.test(q)) return 'javascript';
  if (/\bjava\b/.test(q) && !/javascript/.test(q)) return 'java';
  if (/c\+\+|cpp/.test(q)) return 'cpp';
  if (/\bgolang\b/.test(q)) return 'go';
  if (/\brust\b/.test(q)) return 'rust';
  if (/react native/.test(q)) return 'react-native';
  if (/\bflutter\b/.test(q)) return 'flutter';
  return null;
}

function kiemNgonNguKhop(logicValue, langCan) {
  if (!langCan) return true;
  if (!logicValue) return true;
  const { detectLangFromCode } = require('./logicRunner');
  const tipLang = detectLangFromCode(logicValue);
  const alias = {
    'html': ['html', 'css'],
    'python': ['python'],
    'javascript': ['javascript'],
    'java': ['java'],
    'cpp': ['cpp'],
    'go': ['go'],
    'rust': ['rust'],
  };
  const accepted = alias[langCan] || [langCan];
  return accepted.includes(tipLang);
}

module.exports = {
  detectIntent,
  detectLangCan,
  kiemNgonNguKhop,
  SYNONYM_MAP,
  STOP_WORDS,
};