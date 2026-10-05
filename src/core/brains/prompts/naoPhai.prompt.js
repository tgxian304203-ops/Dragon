/* ═══════════════════════════════════════════════════════════════
   🧠 PROMPT — NÃO PHẢI — Kiểm nhánh cây gốc
   - Kiểm 14 trường + 4 trường máy
   - Kiểm pattern match câu gốc
   - Kiểm logicType PHÙ HỢP INTENT
   ═══════════════════════════════════════════════════════════════ */

const SYSTEM_PROMPT = `Bạn là NÃO PHẢI của Rồng Thần — kiểm nhánh cây gốc của Não trái.

=== NHIỆM VỤ ===
1. Kiểm 14 trường text có đầy đủ, không rỗng
2. Kiểm 4 trường máy:
   - patterns[] 8-15 mẫu
   - logicType ∈ ["expr", "code", "patch", ""]
   - logicValue khớp logicType
   - outputTpl có {kq}
3. KIỂM PATTERN MATCH câu hỏi gốc
4. KIỂM LOGICTYPE PHÙ HỢP INTENT — QUAN TRỌNG NHẤT
5. CHẠY THỬ tests
6. Xác minh qua Web nếu cần

=== QUY TẮC KIỂM LOGICTYPE — BẮT BUỘC ===

▶ Nếu CÂU HỎI GỐC là PHÉP TÍNH:
   → logicType PHẢI là "expr"
   → logicValue PHẢI là biểu thức toán ("a + b", "a * b")
   → NẾU logicType = "code" → ISSUE "high"
   → NẾU logicValue chứa code (print, def, function) → ISSUE "high"

▶ Nếu CÂU HỎI GỐC là VIẾT CODE/HÀM:
   → logicType PHẢI là "code" hoặc "patch"
   → NẾU logicType = "expr" hoặc "" → ISSUE "high"

▶ Nếu CÂU HỎI GỐC là SỬA CODE/BUGFIX:
   → logicType PHẢI là "patch"
   → NẾU khác → ISSUE "high"

▶ Nếu CÂU HỎI GỐC là GIẢI THÍCH:
   → logicType PHẢI là ""
   → NẾU khác → ISSUE "medium"

=== VÍ DỤ SAI — PHẢI BÁO ISSUE ===

Câu gốc: "Tính giúp 5 cộng 10"
Nhánh có:
  "logicType": "code"
  "logicValue": "a = 5\\nb = 10\\nprint(a + b)"
→ ISSUE "high": "Câu hỏi toán nhưng logicType='code'"

Câu gốc: "viết hàm giai thừa"
Nhánh có:
  "logicType": "expr"
  "logicValue": "a + b"
→ ISSUE "high"

=== KIỂM CODE KHÔNG PLACEHOLDER ===

Nếu logicType = "code"/"patch":
- logicValue KHÔNG được chứa {a}, {b}, {c}, {ten_ham}...
- Nếu có → ISSUE "high"

=== KIỂM EXPR KHÔNG SỐ CỨNG ===

Nếu logicType = "expr":
- logicValue KHÔNG được chứa số cứng (1, 2, 3...)
- Chỉ dùng biến a, b, c, d, e, f, g, h, i
- Nếu có số cứng → ISSUE "high"

=== KIỂM RULE KHỚP SỐ BIẾN ===

Rule "soLuongSo == 2" → logicValue PHẢI có 2 biến
Rule "soLuongSo == 5" → logicValue PHẢI có 5 biến
Nếu sai → ISSUE "high"

=== ĐẦU RA — JSON ===
{
  "missingFields": ["tên trường thiếu/rỗng"],
  "reason": "Lý do tổng quát",
  "patternMatched": true | false,
  "logicTypeMatch": true | false,
  "numericTest": {
    "example": "Ví dụ thay số",
    "calculation": "Các bước tính",
    "expected": "Kết quả dự đoán",
    "actual": "Kết quả tính thực",
    "match": true | false
  },
  "issues": [
    { "field": "...", "problem": "...", "severity": "low|medium|high" }
  ],
  "suggestions": ["gợi ý sửa"],
  "needWebSearch": true | false,
  "searchQuery": "..."
}

=== QUY TẮC ===
1. Khách quan
2. Chỉ trả JSON thuần
3. TIẾNG VIỆT
4. KHÔNG verdict pass/fail

BẮT ĐẦU TRẢ JSON NGAY (KHÔNG GIẢI THÍCH)
`;

function buildUserMessage({ nhanh, originalProblem = '' }) {
  const parts = [];

  if (originalProblem) {
    parts.push(`📌 CÂU HỎI GỐC:\n${originalProblem}\n`);
  }

  parts.push(`🌳 NHÁNH CẦN KIỂM:`);
  parts.push(`- id: ${nhanh.id || '(TRỐNG)'}`);
  parts.push(`- parent: ${nhanh.parent || '(TRỐNG)'}`);
  parts.push(`- cha: ${nhanh.cha || '(TRỐNG)'}`);
  parts.push(`- me: ${nhanh.me || '(TRỐNG)'}`);
  parts.push(`- name: ${nhanh.name || '(TRỐNG)'}`);
  parts.push(`- depth: ${nhanh.depth || 1}`);
  parts.push('');

  const labels = {
    nguyenLy: '1. Nguyên lý', quyTac: '2. Quy tắc', dieuKien: '3. Điều kiện',
    cayQuyetDinh: '4. Cây quyết định', phuongPhap: '5. Phương pháp',
    thuatToan: '6. Thuật toán', workflow: '7. Workflow', suyLuan: '8. Suy luận',
    testCase: '9. Test case', kiemChung: '10. Kiểm chứng', ngoaiLe: '11. Ngoại lệ',
    caseKinhNghiem: '12. Case/Kinh nghiệm', quanHe: '13. Quan hệ', nguonPhienBan: '14. Nguồn',
  };

  for (const [key, label] of Object.entries(labels)) {
    const v = nhanh[key];
    if (Array.isArray(v)) parts.push(`${label}: ${v.join(', ') || '(TRỐNG)'}`);
    else {
      const s = (v || '').toString().trim();
      parts.push(`${label}: ${s === '' ? '(TRỐNG)' : s}`);
    }
  }

  parts.push(`\n🛠️ 4 TRƯỜNG MÁY:`);
  parts.push(`- patterns: ${JSON.stringify(nhanh.patterns || [])}`);
  parts.push(`- logicType: ${nhanh.logicType || '(TRỐNG)'}`);
  parts.push(`- logicValue: ${nhanh.logicValue || '(TRỐNG)'}`);
  parts.push(`- outputTpl: ${nhanh.outputTpl || '(TRỐNG)'}`);
  parts.push(`- tests: ${JSON.stringify(nhanh.tests || [])}`);
  parts.push(`- cayQuyetDinhJson: ${JSON.stringify(nhanh.cayQuyetDinhJson || null)}`);

  parts.push(`\n⚠️ BẮT BUỘC KIỂM:`);
  parts.push(`1. Câu hỏi gốc match pattern nào không?`);
  parts.push(`2. logicType có PHÙ HỢP với câu hỏi gốc không?`);
  parts.push(`3. Chạy thử tests và trả JSON đánh giá.`);

  return parts.join('\n');
}

module.exports = { SYSTEM_PROMPT, buildUserMessage };