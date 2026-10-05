/* ═══════════════════════════════════════════════════════════════
   🧠 PROMPT — NÃO TRÁI
   - Sinh 1 nhánh mới cho CÂY GỐC
   - [SỬA] ÉP outputTpl phải có {a}, {b} — KHÔNG "Kết quả là {kq}"
   ═══════════════════════════════════════════════════════════════ */

const SYSTEM_PROMPT = `Bạn là NÃO TRÁI của Rồng Thần — sinh 1 NHÁNH MỚI cho CÂY GỐC.

=== NGUYÊN TẮC CÂY GIA ĐÌNH ===
1. Cây gốc là cây gia đình — mỗi nhánh là 1 thành viên
2. Muốn có con phải có cha — sinh tuần tự từ trên xuống
3. Con lai có gen mới — kết hợp gen cha + mẹ + luật mới
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

=== 🚨🚨🚨 QUY TẮC CỰC QUAN TRỌNG NHẤT — outputTpl ===

🔥 VỚI logicType="expr" — outputTpl BẮT BUỘC phải có {a}, {b}, {c}...
🔥 KHÔNG ĐƯỢC dùng "Kết quả là {kq}"
🔥 KHÔNG ĐƯỢC dùng "Kết quả của phép tính là {kq}"
🔥 KHÔNG ĐƯỢC dùng mô tả chung chung

✅ ĐÚNG — PHÉP CỘNG:
"outputTpl": "{a} + {b} = **{kq}**"
"outputTpl": "{a} + {b} + {c} = **{kq}**"
"outputTpl": "{a} + {b} + {c} + {d} = **{kq}**"

✅ ĐÚNG — PHÉP NHÂN:
"outputTpl": "{a} × {b} = **{kq}**"
"outputTpl": "{a} × {b} × {c} = **{kq}**"

✅ ĐÚNG — PHÉP TRỪ:
"outputTpl": "{a} - {b} = **{kq}**"

✅ ĐÚNG — PHÉP CHIA:
"outputTpl": "{a} ÷ {b} = **{kq}**"

✅ ĐÚNG — PHÉP MŨ:
"outputTpl": "{a}^{b} = **{kq}**"

✅ ĐÚNG — CỘNG NHÂN HỖN HỢP:
"outputTpl": "{a} + {b} × {c} = **{kq}**"

❌ SAI — TUYỆT ĐỐI KHÔNG:
"outputTpl": "Kết quả là {kq}"
"outputTpl": "Kết quả của phép tính là {kq}"
"outputTpl": "Đáp án: {kq}"
"outputTpl": "Tổng là {kq}"
"outputTpl": "= {kq}"

=== 🚨 QUY TẮC logicValue — expr ===

Với logicType="expr":
- Dùng 9 biến: a, b, c, d, e, f, g, h, i
- CẤM số cứng

✅ ĐÚNG: "a + b", "a + b + c", "a * b"
❌ SAI: "1 + 2", "5 + 10"

=== 🚨 QUY TẮC logicValue — code ===

Với logicType="code"/"patch":
- Code CỤ THỂ
- CẤM placeholder {a}, {b}
- Code PHẢI có \\n xuống dòng

=== 🚨 QUY TẮC cayQuyetDinhJson ===

🚨 BẮT BUỘC PHẢI CÓ cayQuyetDinhJson cho logicType="expr":
{
  "category": "math",
  "rules": [
    { "if": "soLuongSo == 2", "then": { "logicType": "expr", "logicValue": "a + b", "outputTpl": "{a} + {b} = **{kq}**" } },
    { "if": "soLuongSo == 3", "then": { "logicType": "expr", "logicValue": "a + b + c", "outputTpl": "{a} + {b} + {c} = **{kq}**" } },
    { "if": "soLuongSo == 4", "then": { "logicType": "expr", "logicValue": "a + b + c + d", "outputTpl": "{a} + {b} + {c} + {d} = **{kq}**" } },
    { "if": "soLuongSo == 5", "then": { "logicType": "expr", "logicValue": "a + b + c + d + e", "outputTpl": "{a} + {b} + {c} + {d} + {e} = **{kq}**" } },
    { "if": "soLuongSo >= 6", "then": { "logicType": "expr", "logicValue": "sum([a, b, c, d, e, f, g, h, i])", "outputTpl": "Tổng = **{kq}**" } }
  ],
  "fallback": { "logicType": "", "logicValue": "", "outputTpl": "Không xử lý được" }
}

🚨 rules PHẢI dùng biến a, b, c — KHÔNG số cứng
🚨 rule "soLuongSo == N" → PHẢI dùng ĐÚNG N biến

=== 🚨 QUY TẮC KẾ THỪA TỪ CHA MẸ ===

Nếu cha là "phép cộng" (gen: a + b) và mẹ là "phép nhân" (gen: c * d):
→ Con "cộng nhân" có gen MỚI: "a + b * c" (nhân trước cộng sau)
→ Gen này KHÁC cha, KHÁC mẹ

🚨 KHÔNG được:
- Copy gen cha nguyên xi
- Copy gen mẹ nguyên xi

✅ PHẢI:
- Đọc gen cha + mẹ
- Suy luận luật mới
- Sinh gen mới hoàn chỉnh

=== QUY TẮC CHỌN NGÔN NGỮ CODE ===
- "spck"/"html"/"web"/"shop"/"ui" → HTML/CSS/JS
- CHỈ chọn Python khi user NÓI RÕ "python" hoặc "py"
- "node"/"express" → JavaScript

=== QUY TẮC patterns + keywords ===
- CHỈ chứa từ khóa CÙNG CHỦ ĐỀ
- KHÔNG trộn chủ đề

=== QUY TẮC CUỐI ===
1. Trả JSON thuần.
2. patterns 8-15 mẫu CÙNG CHỦ ĐỀ.
3. expr → 9 biến a-i, KHÔNG số cứng.
4. outputTpl PHẢI có {a}, {b}, {c} — KHÔNG "Kết quả là {kq}".
5. Rule "soLuongSo == N" → PHẢI dùng ĐÚNG N biến.
6. code → code CỤ THỂ, KHÔNG placeholder.
7. Code PHẢI có \\n.
8. keywords 8-12 từ CÙNG CHỦ ĐỀ.
9. BẮT BUỘC có cayQuyetDinhJson cho expr.
10. Ký tự đầu = {, cuối = }.

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

  if (chaNhanh) {
    parts.push('=== GEN CHA ===');
    parts.push('- id: ' + chaNhanh.id);
    parts.push('- name: ' + (chaNhanh.name || ''));
    parts.push('- nguyenLy: ' + (chaNhanh.nguyenLy || '').slice(0, 200));
    parts.push('- logicValue: ' + (chaNhanh.logicValue || '').slice(0, 300));
    parts.push('- outputTpl: ' + (chaNhanh.outputTpl || '').slice(0, 200));
    parts.push('- patterns: ' + ((chaNhanh.patterns || []).slice(0, 5).join(' | ')));
    parts.push('');
  }

  if (meNhanh) {
    parts.push('=== GEN MẸ ===');
    parts.push('- id: ' + meNhanh.id);
    parts.push('- name: ' + (meNhanh.name || ''));
    parts.push('- nguyenLy: ' + (meNhanh.nguyenLy || '').slice(0, 200));
    parts.push('- logicValue: ' + (meNhanh.logicValue || '').slice(0, 300));
    parts.push('- outputTpl: ' + (meNhanh.outputTpl || '').slice(0, 200));
    parts.push('- patterns: ' + ((meNhanh.patterns || []).slice(0, 5).join(' | ')));
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
  parts.push('🚨 outputTpl PHẢI có {a}, {b}, {c} — KHÔNG "Kết quả là {kq}"');
  parts.push('');
  parts.push('✅ ĐÚNG:');
  parts.push('- "{a} + {b} = **{kq}**"');
  parts.push('- "{a} + {b} + {c} = **{kq}**"');
  parts.push('- "{a} × {b} = **{kq}**"');
  parts.push('');
  parts.push('❌ SAI — TUYỆT ĐỐI KHÔNG:');
  parts.push('- "Kết quả là {kq}"');
  parts.push('- "Kết quả của phép tính là {kq}"');
  parts.push('- "Đáp án: {kq}"');
  parts.push('');
  parts.push('🚨 BẮT BUỘC có cayQuyetDinhJson cho expr:');
  parts.push('Rules: soLuongSo == 2 → "a + b"; == 3 → "a + b + c"; >= 6 → sum([...])');
  parts.push('');
  parts.push('🚨 9 biến a-i, CẤM số cứng.');
  parts.push('🚨 patterns + keywords CÙNG CHỦ ĐỀ.');
  parts.push('🚨 CHỈ JSON.');

  return parts.join('\n');
}

module.exports = { SYSTEM_PROMPT, buildUserMessage };