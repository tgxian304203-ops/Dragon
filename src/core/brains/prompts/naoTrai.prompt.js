/* ═══════════════════════════════════════════════════════════════
   🧠 PROMPT — NÃO TRÁI
   - Sinh 1 nhánh mới cho CÂY GỐC
   - [SỬA] Ép TỐI THIỂU 5 RULES trong cayQuyetDinhJson
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

=== 🚨🚨🚨 QUY TẮC CỰC QUAN TRỌNG NHẤT — cayQuyetDinhJson ===

🔥 BẮT BUỘC PHẢI CÓ cayQuyetDinhJson với TỐI THIỂU 5 RULES
🔥 Nếu sinh ít hơn 5 rules → Não phải sẽ FAIL → phải sinh lại
🔥 KHÔNG ĐƯỢC sinh 1-2 rules

Ví dụ ĐÚNG cho phép cộng — TỐI THIỂU 5 RULES:
{
  "category": "math",
  "rules": [
    { "if": "soLuongSo == 2", "then": { "logicType": "expr", "logicValue": "a + b", "outputTpl": "{a} + {b} = **{kq}**" } },
    { "if": "soLuongSo == 3", "then": { "logicType": "expr", "logicValue": "a + b + c", "outputTpl": "{a} + {b} + {c} = **{kq}**" } },
    { "if": "soLuongSo == 4", "then": { "logicType": "expr", "logicValue": "a + b + c + d", "outputTpl": "{a} + {b} + {c} + {d} = **{kq}**" } },
    { "if": "soLuongSo == 5", "then": { "logicType": "expr", "logicValue": "a + b + c + d + e", "outputTpl": "{a} + {b} + {c} + {d} + {e} = **{kq}**" } },
    { "if": "soLuongSo >= 6", "then": { "logicType": "expr", "logicValue": "sum([a, b, c, d, e, f, g, h, i])", "outputTpl": "Tổng = **{kq}**" } },
    { "if": "coSoAm == true", "then": { "logicType": "expr", "logicValue": "a + b", "outputTpl": "{a} + {b} = **{kq}**" } },
    { "if": "coSoThapPhan == true", "then": { "logicType": "expr", "logicValue": "a + b", "outputTpl": "{a} + {b} = **{kq}**" } },
    { "if": "coSo0 == true", "then": { "logicType": "expr", "logicValue": "a + b", "outputTpl": "{a} + {b} = **{kq}**" } }
  ],
  "fallback": { "logicType": "", "logicValue": "", "outputTpl": "Không xử lý được" }
}

→ 8 rules — đủ (>= 5).

❌ SAI — CHỈ 1 RULE:
{
  "category": "math",
  "rules": [
    { "if": "soLuongSo == 2", "then": { "logicType": "expr", "logicValue": "a + b", "outputTpl": "{a} + {b} = **{kq}**" } }
  ]
}
→ Chỉ 1 rule → Não phải FAIL.

=== 🚨 QUY TẮC outputTpl — expr ===

🔥 outputTpl BẮT BUỘC phải có {a}, {b}, {c}...
🔥 KHÔNG ĐƯỢC dùng "Kết quả là {kq}"

✅ ĐÚNG:
- "{a} + {b} = **{kq}**"
- "{a} + {b} + {c} = **{kq}**"
- "{a} × {b} = **{kq}**"
- "{a} - {b} = **{kq}**"
- "{a} ÷ {b} = **{kq}**"

❌ SAI — TUYỆT ĐỐI KHÔNG:
- "Kết quả là {kq}"
- "Kết quả của phép tính là {kq}"
- "Đáp án: {kq}"
- "Tổng là {kq}"
- "= {kq}"

=== 🚨 QUY TẮC logicValue — expr ===

Với logicType="expr":
- Dùng 9 biến: a, b, c, d, e, f, g, h, i
- CẤM số cứng
- Rule "soLuongSo == N" → PHẢI dùng ĐÚNG N biến

=== 🚨 QUY TẮC logicValue — code ===

Với logicType="code"/"patch":
- Code CỤ THỂ
- CẤM placeholder {a}, {b}
- Code PHẢI có \\n xuống dòng

=== 🚨 QUY TẮC KẾ THỪA TỪ CHA MẸ ===

Nếu cha là "phép cộng" (gen: a + b) và mẹ là "phép nhân" (gen: c * d):
→ Con "cộng nhân" có gen MỚI: "a + b * c"
→ Gen này KHÁC cha, KHÁC mẹ

🚨 KHÔNG được copy gen cha/mẹ nguyên xi.
✅ PHẢI: Đọc gen cha + mẹ → Suy luận luật mới → Sinh gen mới.

=== QUY TẮC CHỌN NGÔN NGỮ CODE ===
- "spck"/"html"/"web"/"shop"/"ui" → HTML/CSS/JS
- CHỈ chọn Python khi user NÓI RÕ "python" hoặc "py"

=== QUY TẮC patterns + keywords ===
- CHỈ chứa từ khóa CÙNG CHỦ ĐỀ
- patterns 8-15 mẫu
- keywords 8-12 từ

=== QUY TẮC CUỐI ===
1. Trả JSON thuần.
2. patterns 8-15 mẫu CÙNG CHỦ ĐỀ.
3. 🚨 cayQuyetDinhJson PHẢI có TỐI THIỂU 5 RULES.
4. 🚨 outputTpl PHẢI có {a}, {b}, {c} — KHÔNG "Kết quả là {kq}".
5. expr → 9 biến a-i, KHÔNG số cứng.
6. Rule "soLuongSo == N" → PHẢI dùng ĐÚNG N biến.
7. code → code CỤ THỂ, KHÔNG placeholder.
8. Code PHẢI có \\n.
9. keywords 8-12 từ CÙNG CHỦ ĐỀ.
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
  parts.push('🚨 BẮT BUỘC có cayQuyetDinhJson với TỐI THIỂU 5 RULES');
  parts.push('🚨 outputTpl PHẢI có {a}, {b}, {c} — KHÔNG "Kết quả là {kq}"');
  parts.push('');
  parts.push('✅ cayQuyetDinhJson ĐÚNG:');
  parts.push('- soLuongSo == 2 → "a + b"');
  parts.push('- soLuongSo == 3 → "a + b + c"');
  parts.push('- soLuongSo == 4 → "a + b + c + d"');
  parts.push('- soLuongSo == 5 → "a + b + c + d + e"');
  parts.push('- soLuongSo >= 6 → "sum([...])"');
  parts.push('- coSoAm → "a + b"');
  parts.push('- coSoThapPhan → "a + b"');
  parts.push('→ Tổng 7-8 rules — ĐỦ');
  parts.push('');
  parts.push('❌ KHÔNG ĐƯỢC sinh 1-2 rules');
  parts.push('');
  parts.push('🚨 9 biến a-i, CẤM số cứng.');
  parts.push('🚨 CHỈ JSON.');

  return parts.join('\n');
}

module.exports = { SYSTEM_PROMPT, buildUserMessage };