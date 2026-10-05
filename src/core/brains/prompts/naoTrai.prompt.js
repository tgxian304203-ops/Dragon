/* ═══════════════════════════════════════════════════════════════
   🧠 PROMPT — NÃO TRÁI
   - Sinh 1 nhánh mới trong cây gốc
   - Nhận cha + mẹ (nếu con lai)
   - Kế thừa từ cha mẹ
   ═══════════════════════════════════════════════════════════════ */

const SYSTEM_PROMPT = `Bạn là NÃO TRÁI của Rồng Thần — sinh 1 NHÁNH MỚI cho CÂY GỐC.

=== NGUYÊN TẮC CÂY GIA ĐÌNH ===
1. Cây gốc là cây gia đình — mỗi nhánh là 1 thành viên
2. Muốn có con phải có cha — sinh tuần tự từ trên xuống
3. Con LAi có gen mới — kết hợp gen cha + mẹ + luật mới
4. Gen không mất — kế thừa gián tiếp qua cha mẹ

=== QUY TẮC OUTPUT ===
1. CHỈ trả JSON THUẦN.
2. KHÔNG bọc trong markdown hay backticks.
3. Ký tự đầu = {, cuối = }.

=== ĐẦU RA JSON ===
{
  "name": "Tên nhánh",
  "nguyenLy": "...", "quyTac": "...", "dieuKien": "...", "cayQuyetDinh": "...",
  "phuongPhap": "...", "thuatToan": "...", "workflow": "...", "suyLuan": "...",
  "testCase": "...", "kiemChung": "...", "ngoaiLe": "...", "caseKinhNghiem": "...",
  "quanHe": [...], "nguonPhienBan": "Rồng Thần v2.0",
  "category": "math|code|van|explain|general",
  "keywords": [...],
  "patterns": [...],
  "logicType": "expr|code|patch|",
  "logicValue": "...",
  "outputTpl": "...",
  "tests": [...],
  "cayQuyetDinhJson": {
    "category": "...",
    "rules": [...],
    "fallback": {...}
  }
}

=== QUY TẮC CỰC QUAN TRỌNG ===

LOẠI 1 — logicType="expr" (TOÁN):
- Dùng 9 biến: a, b, c, d, e, f, g, h, i
- CẤM số cứng: 1, 2, 3, 4, 5

ĐÚNG: "a + b", "a + b + c", "a * b"
SAI: "1 + 2", "5 + 10"

LOẠI 2 — logicType="code" (CODE):
- Code CỤ THỂ
- CẤM placeholder {a}, {b}, {c}

ĐÚNG:
"logicValue": "<!DOCTYPE html>\\n<html>\\n<head>\\n<title>Shop Đồng Hồ</title>\\n</head>\\n<body>\\n</body>\\n</html>"

SAI:
"logicValue": "<title>{a}</title>"

LOẠI 3 — logicType="patch" (SỬA CODE):
- Code đã sửa
- CẤM placeholder

=== QUY TẮC KẾ THỪA TỪ CHA MẸ ===

🚨 Đây là CON LAI — kết hợp gen cha + mẹ:

Nếu cha là "phép cộng" (gen: a + b) và mẹ là "phép nhân" (gen: c * d):
→ Con "cộng nhân" có gen MỚI: "a + b * c" (nhân trước cộng sau)
→ Gen này KHÁC cha, KHÁC mẹ, KHÁC cha+mẹ ghép lại

🚨 KHÔNG được:
- Copy gen cha nguyên xi
- Copy gen mẹ nguyên xi
- Ghép cha mẹ đơn giản

✅ PHẢI:
- Đọc gen cha + mẹ
- Suy luận luật mới (VD: thứ tự ưu tiên)
- Sinh gen mới hoàn chỉnh

=== QUY TẮC CHỌN NGÔN NGỮ CODE ===
- "spck"/"html"/"web"/"shop"/"ui" → HTML/CSS/JS
- CHỈ chọn Python khi user NÓI RÕ "python" hoặc "py"
- "node"/"express" → JavaScript

=== QUY TẮC CODE PHẢI CÓ \\n ===
- Code PHẢI có xuống dòng (\\n)

=== QUY TẮC patterns + keywords ===
- CHỈ chứa từ khóa CÙNG CHỦ ĐỀ
- KHÔNG trộn chủ đề

=== QUY TẮC CUỐI ===
1. Trả JSON thuần.
2. patterns 8-15 mẫu CÙNG CHỦ ĐỀ.
3. expr → 9 biến a-i, KHÔNG số cứng.
4. Rule "soLuongSo == N" → PHẢI dùng ĐÚNG N biến.
5. code → code CỤ THỂ, KHÔNG placeholder.
6. Code PHẢI có \\n.
7. keywords 8-12 từ CÙNG CHỦ ĐỀ.
8. outputTpl có {kq}.
9. Ký tự đầu = {, cuối = }.

BẮT ĐẦU TRẢ JSON NGAY.
`;

function buildUserMessage({
  problem, context = '', id, parent, cha, me, depth,
  chaNhanh = null, meNhanh = null,
  userProfile = null, intentHistory = [],
}) {
  const parts = [];
  parts.push('=== NHIỆM VỤ ===');
  parts.push('Sinh 1 nhánh MỚI cho cây gốc để xử lý câu hỏi của user.');
  parts.push('');
  parts.push('📌 VẤN ĐỀ USER: ' + problem);
  parts.push('');
  parts.push('=== VỊ TRÍ NHÁNH MỚI ===');
  parts.push('- id nhánh mới: ' + id);
  parts.push('- parent: ' + (parent || 'root'));
  parts.push('- cha ruột: ' + (cha || '(không có)'));
  parts.push('- mẹ ruột: ' + (me || '(không có — không phải con lai)'));
  parts.push('- độ sâu: ' + (depth || 1));
  parts.push('');

  // Gen cha
  if (chaNhanh) {
    parts.push('=== GEN CHA ===');
    parts.push('- id: ' + chaNhanh.id);
    parts.push('- name: ' + (chaNhanh.name || ''));
    parts.push('- nguyenLy: ' + (chaNhanh.nguyenLy || '').slice(0, 200));
    parts.push('- logicValue: ' + (chaNhanh.logicValue || '').slice(0, 300));
    parts.push('- patterns: ' + ((chaNhanh.patterns || []).slice(0, 5).join(' | ')));
    parts.push('- rules: ' + JSON.stringify((chaNhanh.cayQuyetDinhJson?.rules || []).slice(0, 3)));
    parts.push('');
  }

  // Gen mẹ
  if (meNhanh) {
    parts.push('=== GEN MẸ ===');
    parts.push('- id: ' + meNhanh.id);
    parts.push('- name: ' + (meNhanh.name || ''));
    parts.push('- nguyenLy: ' + (meNhanh.nguyenLy || '').slice(0, 200));
    parts.push('- logicValue: ' + (meNhanh.logicValue || '').slice(0, 300));
    parts.push('- patterns: ' + ((meNhanh.patterns || []).slice(0, 5).join(' | ')));
    parts.push('- rules: ' + JSON.stringify((meNhanh.cayQuyetDinhJson?.rules || []).slice(0, 3)));
    parts.push('');
  }

  if (userProfile) {
    parts.push('=== USER PROFILE ===');
    if (userProfile.preferredLang) parts.push('- Ngôn ngữ ưa thích: ' + userProfile.preferredLang);
    if (userProfile.techStack && userProfile.techStack.length) parts.push('- Tech stack: ' + userProfile.techStack.join(', '));
    if (userProfile.preferredEditor) parts.push('- Editor: ' + userProfile.preferredEditor);
    parts.push('');
  }

  if (intentHistory && intentHistory.length) {
    parts.push('=== LỊCH SỬ INTENT ===');
    parts.push(intentHistory.slice(-10).join(' > '));
    parts.push('');
  }

  if (context) {
    parts.push('=== NGỮ CẢNH ===');
    parts.push(context);
    parts.push('');
  }

  parts.push('=== QUY TẮC QUAN TRỌNG NHẤT ===');
  parts.push('');
  parts.push('1. Nhánh MỚI phải KẾ THỪA từ cha mẹ nhưng có GEN MỚI.');
  parts.push('2. Nếu là CON LAI → kết hợp gen cha + mẹ + luật mới.');
  parts.push('');
  parts.push('NẾU logicType="expr" (TOÁN):');
  parts.push('- Dùng 9 biến: a, b, c, d, e, f, g, h, i');
  parts.push('- CẤM số cứng');
  parts.push('- Rule "soLuongSo == N" → PHẢI dùng ĐÚNG N biến');
  parts.push('');
  parts.push('NẾU logicType="code" (CODE):');
  parts.push('- Code CỤ THỂ');
  parts.push('- CẤM placeholder {a}, {b}');
  parts.push('- Code PHẢI có \\n xuống dòng');
  parts.push('');
  parts.push('CHỌN NGÔN NGỮ CODE:');
  parts.push('- "spck"/"html"/"web" → HTML/CSS/JS');
  parts.push('- CHỈ chọn Python khi user NÓI RÕ "python"');
  parts.push('');
  parts.push('patterns + keywords CÙNG CHỦ ĐỀ.');
  parts.push('cayQuyetDinhJson có đủ rules cover biến thể.');
  parts.push('CHỈ JSON.');

  return parts.join('\n');
}

module.exports = { SYSTEM_PROMPT, buildUserMessage };