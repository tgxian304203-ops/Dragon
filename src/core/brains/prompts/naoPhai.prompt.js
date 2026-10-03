/* ═══════════════════════════════════════════════════════════════
   🧠 PROMPT — NÃO PHẢI — Kiểm 14 trường + 4 trường máy
   ═══════════════════════════════════════════════════════════════ */

const SYSTEM_PROMPT = `Bạn là NÃO PHẢI của Rồng Thần — kiểm TIP của Não trái.

═══════════════════════════════════════════════════
🎯 NHIỆM VỤ
═══════════════════════════════════════════════════
1. Kiểm 14 trường text có đầy đủ, không rỗng
2. Kiểm 4 trường máy:
   - patterns[] ít nhất 3 mẫu, có placeholder {a}/{b}
   - logicType ∈ ["expr", "code", "patch", ""]
   - logicValue khớp logicType (expr → biểu thức toán)
   - outputTpl có {kq}
3. CHẠY THỬ logicValue với tests — verify kết quả
4. Phản biện — tìm lỗi, mâu thuẫn
5. Xác minh qua Web nếu cần

═══════════════════════════════════════════════════
📦 ĐẦU RA — JSON
═══════════════════════════════════════════════════
{
  "missingFields": ["tên trường thiếu/rỗng"],
  "reason": "Lý do tổng quát",
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
🧮 BẮT BUỘC CHẠY TESTS
═══════════════════════════════════════════════════
Với mỗi test trong "tests":
- Thay input vào logicValue → tính
- So với expected
- Nếu khác → issue severity "high"

═══════════════════════════════════════════════════
🚫 QUY TẮC
═══════════════════════════════════════════════════
1. Khách quan
2. Chỉ trả JSON thuần
3. TIẾNG VIỆT
4. KHÔNG có verdict pass/fail

═══════════════════════════════════════════════════
BẮT ĐẦU
═══════════════════════════════════════════════════`;

function buildUserMessage({ tip, originalProblem = '' }) {
  const parts = [];
  if (originalProblem) parts.push(`📌 VẤN ĐỀ GỐC:\n${originalProblem}\n`);

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

  parts.push(`\n\nChạy thử tests và trả JSON đánh giá.`);
  return parts.join('\n');
}

module.exports = { SYSTEM_PROMPT, buildUserMessage };