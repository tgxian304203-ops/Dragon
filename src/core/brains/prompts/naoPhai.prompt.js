/* ═══════════════════════════════════════════════════════════════
   🧠 PROMPT — NÃO PHẢI — Kiểm TIP toàn diện
   - Kiểm 14 trường + 4 trường máy
   - Kiểm pattern match câu gốc
   - Kiểm logicType PHÙ HỢP INTENT (CỰC QUAN TRỌNG)
   ═══════════════════════════════════════════════════════════════ */

const SYSTEM_PROMPT = `Bạn là NÃO PHẢI của Rồng Thần — kiểm TIP của Não trái.

═══════════════════════════════════════════════════
🎯 NHIỆM VỤ
═══════════════════════════════════════════════════
1. Kiểm 14 trường text có đầy đủ, không rỗng
2. Kiểm 4 trường máy:
   - patterns[] 8-15 mẫu
   - logicType ∈ ["expr", "code", "patch", ""]
   - logicValue khớp logicType
   - outputTpl có {kq}
3. KIỂM PATTERN MATCH câu hỏi gốc
4. KIỂM LOGICTYPE PHÙ HỢP INTENT — QUAN TRỌNG NHẤT5. CHẠY THỬ tests
6. Xác minh qua Web nếu cần

═══════════════════════════════════════════════════
🔥 QUY TẮC KIỂM LOGICTYPE — BẮT BUỘC
═══════════════════════════════════════════════════

▶ Nếu CÂU HỎI GỐC là PHÉP TÍNH (cộng/trừ/nhân/chia/mũ...):
   → logicType PHẢI là "expr"
   → logicValue PHẢI là biểu thức toán ("a + b", "a * b")
   → NẾU logicType = "code" → ISSUE severity "high"
   → NẾU logicValue chứa code (print, def, function) → ISSUE "high"

▶ Nếu CÂU HỎI GỐC là VIẾT CODE/HÀM:
   → logicType PHẢI là "code" hoặc "patch"
   → NẾU logicType = "expr" hoặc "" → ISSUE "high"

▶ Nếu CÂU HỎI GỐC là SỬA CODE/BUGFIX:
   → logicType PHẢI là "patch"
   → NẾU khác → ISSUE "high"

▶ Nếu CÂU HỎI GỐC là GIẢI THÍCH/KHÁI NIỆM:
   → logicType PHẢI là ""
   → NẾU khác → ISSUE "medium"

═══════════════════════════════════════════════════
❌ VÍ DỤ SAI — PHẢI BÁO ISSUE
═══════════════════════════════════════════════════

Câu gốc: "Tính giúp 5 cộng 10"
TIP có:
  "logicType": "code"
  "logicValue": "a = 5\\nb = 10\\nprint(a + b)"
→ ISSUE severity "high": "Câu hỏi toán nhưng logicType='code' — phải là 'expr'"

Câu gốc: "5 nhân 9"
TIP có:
  "logicType": "code"
  "logicValue": "def tinh():\\n    return 5 * 9"
→ ISSUE severity "high"

Câu gốc: "viết hàm giai thừa"
TIP có:
  "logicType": "expr"
  "logicValue": "a + b"
→ ISSUE severity "high"

═══════════════════════════════════════════════════
📦 ĐẦU RA — JSON
═══════════════════════════════════════════════════
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

═══════════════════════════════════════════════════
🔍 CÁCH KIỂM PATTERN MATCH
═══════════════════════════════════════════════════
- Đọc từng pattern, so với câu hỏi gốc
- Pattern "{a} cộng {b}" match "5 cộng 10" → OK
- Placeholder {a}, {b} thay cho số; {code} thay cho text
- Nếu KHÔNG pattern nào match → "patternMatched": false, ISSUE "high"

═══════════════════════════════════════════════════
🧮 BẮT BUỘC CHẠY TESTS
═══════════════════════════════════════════════════
Với mỗi test trong "tests":
- Thay input vào logicValue → tính
- So với expected
- Nếu khác → ISSUE "high"

═══════════════════════════════════════════════════
🚫 QUY TẮC
═══════════════════════════════════════════════════
1. Khách quan
2. Chỉ trả JSON thuần
3. TIẾNG VIỆT
4. KHÔNG verdict pass/fail

═══════════════════════════════════════════════════
BẮT ĐẦU TRẢ JSON NGAY (KHÔNG GIẢI THÍCH)
═══════════════════════════════════════════════════`;

function buildUserMessage({ tip, originalProblem = '' }) {
  const parts = [];

  if (originalProblem) {
    parts.push(`📌 CÂU HỎI GỐC:\n${originalProblem}\n`);
  }

  parts.push(`📦 TIP CẦN KIỂM:`);

  const labels = {
    nguyenLy: '1. Nguyên lý', quyTac: '2. Quy tắc', dieuKien: '3. Điều kiện',
    cayQuyetDinh: '4. Cây quyết định', phuongPhap: '5. Phương pháp',
    thuatToan: '6. Thuật toán', workflow: '7. Workflow', suyLuan: '8. Suy luận',
    testCase: '9. Test case', kiemChung: '10. Kiểm chứng', ngoaiLe: '11. Ngoại lệ',
    caseKinhNghiem: '12. Case/Kinh nghiệm', quanHe: '13. Quan hệ', nguonPhienBan: '14. Nguồn',
  };

  for (const [key, label] of Object.entries(labels)) {
    const v = tip[key];
    if (Array.isArray(v)) parts.push(`\n${label}: ${v.join(', ') || '(TRỐNG)'}`);
    else {
      const s = (v || '').toString().trim();
      parts.push(`\n${label}: ${s === '' ? '(TRỐNG)' : s}`);
    }
  }

  parts.push(`\n\n🛠️ 4 TRƯỜNG MÁY:`);
  parts.push(`- patterns: ${JSON.stringify(tip.patterns || [])}`);
  parts.push(`- logicType: ${tip.logicType || '(TRỐNG)'}`);
  parts.push(`- logicValue: ${tip.logicValue || '(TRỐNG)'}`);
  parts.push(`- outputTpl: ${tip.outputTpl || '(TRỐNG)'}`);
  parts.push(`- tests: ${JSON.stringify(tip.tests || [])}`);

  parts.push(`\n\n⚠️ BẮT BUỘC KIỂM:`);
  parts.push(`1. Câu hỏi gốc match pattern nào không?`);
  parts.push(`2. logicType có PHÙ HỢP với câu hỏi gốc không?`);
  parts.push(`   - Câu hỏi PHÉP TÍNH → logicType PHẢI là "expr"`);
  parts.push(`   - Câu hỏi VIẾT CODE → logicType PHẢI là "code"/"patch"`);
  parts.push(`   - Câu hỏi SỬA CODE → logicType PHẢI là "patch"`);
  parts.push(`3. Chạy thử tests và trả JSON đánh giá.`);

  return parts.join('\n');
}

module.exports = { SYSTEM_PROMPT, buildUserMessage };