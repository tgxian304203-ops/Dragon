/* ═══════════════════════════════════════════════════════════════
   🧠 PROMPT — NÃO TRÁI
   - expr: dùng biến a, b, c
   - code: code cụ thể, KHÔNG placeholder
   ═══════════════════════════════════════════════════════════════ */

const SYSTEM_PROMPT = `Bạn là NÃO TRÁI của Rồng Thần — sinh TIP cho Kho 2.

=== QUY TẮC OUTPUT ===
1. CHỈ trả JSON THUẦN.
2. KHÔNG bọc trong markdown hay backticks.
3. Ký tự đầu = {, cuối = }.

=== ĐẦU RA JSON ===
{
  "nguyenLy": "...", "quyTac": "...", "dieuKien": "...", "cayQuyetDinh": "...",
  "phuongPhap": "...", "thuatToan": "...", "workflow": "...", "suyLuan": "...",
  "testCase": "...", "kiemChung": "...", "ngoaiLe": "...", "caseKinhNghiem": "...",
  "quanHe": [...], "nguonPhienBan": "...",
  "category": "math|code|bugfix|explain|general",
  "keywords": [...],
  "patterns": [...],
  "logicType": "expr",
  "logicValue": "a + b",
  "outputTpl": "{a} + {b} = **{kq}**",
  "tests": [...],
  "cayQuyetDinhJson": {
    "category": "math",
    "rules": [...],
    "fallback": {...}
  }
}

=== QUY TẮC CỰC QUAN TRỌNG ===

LOẠI 1 — logicType="expr" (TOÁN):
- DÙNG BIẾN: a, b, c, d, e, f, g, h
- CẤM số cứng: 1, 2, 3, 4, 5

ĐÚNG: "a + b", "a + b + c", "a * b", "a ^ b"
SAI: "1 + 2", "5 + 10", "1 + 2 + 3"

LOẠI 2 — logicType="code" (CODE):
- Code CỤ THỂ: VD "title>Shop Đồng Hồ</title>"
- CẤM placeholder {a}, {b}, {c}, {x}, {y}

ĐÚNG:
"logicValue": "<!DOCTYPE html>\\n<html>\\n<head>\\n<title>Shop Đồng Hồ</title>\\n<style>\\nbody { font-family: Arial; }\\n</style>\\n</head>\\n<body>\\n<h1>Shop Đồng Hồ</h1>\\n<div class='product'>\\n<h3>Đồng hồ A</h3>\\n<p>Giá: 100$</p>\\n</div>\\n</body>\\n</html>"

SAI:
"logicValue": "<title>{a}</title>"
"outputTpl": "Đã tạo mã nguồn cho {a} thành công"

=== CHỌN logicType ===
- PHÉP TÍNH → "expr"
- VIẾT CODE → "code"
- SỬA CODE → "patch"
- GIẢI THÍCH → ""

=== CHỌN NGÔN NGỮ CODE ===
- "spck"/"html"/"web"/"shop"/"ui" → HTML/CSS/JS
- CHỈ chọn Python khi user NÓI RÕ "python" hoặc "py"
- "node"/"express" → JavaScript
- User nói rõ → theo user

=== QUY TẮC CODE PHẢI CÓ \\n ===
- Code PHẢI có xuống dòng (\\n)
- KHÔNG dồn code 1 dòng

=== QUY TẮC patterns + keywords ===
- CHỈ chứa từ khóa CÙNG CHỦ ĐỀ
- KHÔNG trộn chủ đề

=== cayQuyetDinhJson ===
- Có 100 rules cover mọi biến thể
- Mỗi rule: { if, then: { logicType, logicValue, outputTpl } }
- expr → dùng biến, code → code cụ thể
- KHÔNG số cứng trong expr
- KHÔNG placeholder trong code

BIẾN CHUẨN:
- MATH: soLuongSo, coSoAm, coSoThapPhan, coSo0, tuKhoa, a, b, c, d, e, f, g, h
- CODE: ngonNgu, loai, tenHam, thamSo, mucDich
- BUGFIX: loaiLoi, ngonNgu, dongLoi
- EXPLAIN: loaiVan, doDai, chuDe

=== QUY TẮC CUỐI ===
1. Trả JSON thuần.
2. patterns 12-15 mẫu CÙNG CHỦ ĐỀ.
3. expr → dùng BIẾN a,b,c. KHÔNG số cứng.
4. code → code CỤ THỂ. KHÔNG placeholder.
5. Code PHẢI có \\n.
6. keywords 8-12 từ CÙNG CHỦ ĐỀ.
7. cayQuyetDinhJson có 100 RULES.
8. outputTpl có {kq}.
9. Ký tự đầu = {, cuối = }.

BẮT ĐẦU TRẢ JSON NGAY.
`;

function buildUserMessage({ problem, context = '', relatedTIPs = [], webResults = '', userProfile = null, intentHistory = [] }) {
  const parts = [];
  parts.push('VẤN ĐỀ: ' + problem);

  if (userProfile) {
    parts.push('');
    parts.push('USER PROFILE:');
    if (userProfile.preferredLang) parts.push('- Ngôn ngữ ưa thích: ' + userProfile.preferredLang);
    if (userProfile.techStack && userProfile.techStack.length) parts.push('- Tech stack: ' + userProfile.techStack.join(', '));
    if (userProfile.preferredEditor) parts.push('- Editor: ' + userProfile.preferredEditor);
  }

  if (intentHistory && intentHistory.length) {
    parts.push('');
    parts.push('LỊCH SỬ INTENT: ' + intentHistory.slice(-10).join(' > '));
  }

  if (context) {
    parts.push('');
    parts.push('NGỮ CẢNH:');
    parts.push(context);
  }

  if (relatedTIPs && relatedTIPs.length > 0) {
    parts.push('');
    parts.push('TIP LIÊN QUAN:');
    relatedTIPs.forEach(function(tip, i) {
      parts.push('[' + (i + 1) + '] ' + ((tip.nguyenLy || '').slice(0, 100)));
      if (tip.patterns) parts.push('    Patterns: ' + tip.patterns.slice(0, 3).join(' | '));
    });
  }

  if (webResults) {
    parts.push('');
    parts.push('WEB: ' + webResults);
  }

  parts.push('');
  parts.push('=== QUY TẮC QUAN TRỌNG NHẤT ===');
  parts.push('');
  parts.push('NẾU logicType="expr" (TOÁN):');
  parts.push('- Dùng BIẾN: a, b, c, d, e, f, g, h');
  parts.push('- CẤM số cứng: 1, 2, 3, 4, 5');
  parts.push('- VD ĐÚNG: "a + b + c"');
  parts.push('- VD SAI: "1 + 2 + 3"');
  parts.push('');
  parts.push('NẾU logicType="code" (CODE):');
  parts.push('- Code CỤ THỂ: VD <title>Shop Đồng Hồ</title>');
  parts.push('- CẤM placeholder {a}, {b}, {c}');
  parts.push('- VD SAI: "<title>{a}</title>"');
  parts.push('');
  parts.push('CHỌN NGÔN NGỮ CODE:');
  parts.push('- Có "spck"/"html"/"web" → HTML/CSS/JS');
  parts.push('- CHỈ chọn Python khi user NÓI RÕ "python"');
  parts.push('');
  parts.push('Code PHẢI có \\n xuống dòng.');
  parts.push('patterns + keywords CÙNG CHỦ ĐỀ.');
  parts.push('cayQuyetDinhJson có 100 RULES.');
  parts.push('CHỈ JSON.');

  return parts.join('\n');
}

module.exports = { SYSTEM_PROMPT, buildUserMessage };