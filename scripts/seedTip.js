/* ═══════════════════════════════════════════════════════════════
   🌱 SEED TIP — Nạp TIP mẫu (SC2)
   Cách dùng:
     node scripts/seedTip.js
     node scripts/seedTip.js --clear
   ═══════════════════════════════════════════════════════════════ */

require('dotenv').config();

const { connectDB2, disconnectDB2 } = require('../src/config/db2');
const { getTipModel } = require('../src/models/tip.model');

const SAMPLE_TIPS = [
  {
    nguyenLy: 'Phép cộng hai số nguyên: tổng của a và b là giá trị nhận được khi gộp hai lượng lại với nhau.',
    quyTac: 'a + b = b + a (giao hoán). (a + b) + c = a + (b + c) (kết hợp). a + 0 = a (trung hòa).',
    dieuKien: 'a và b là số (nguyên, thực, hoặc số phức).',
    cayQuyetDinh: 'Nếu cả hai là số dương → cộng bình thường. Nếu một số âm → thực hiện phép trừ trị tuyệt đối. Nếu cả hai âm → cộng trị tuyệt đối rồi đặt dấu âm.',
    phuongPhap: 'Đặt hai số thẳng hàng theo hàng đơn vị, cộng từ phải sang trái, nhớ 1 khi tổng ≥ 10.',
    thuatToan: 'B1: Nhập a, b. B2: Tính S = a + b. B3: Xuất S.',
    workflow: 'Input: hai số a, b → Xử lý: S = a + b → Output: S.\n\n```python\na = 5\nb = 3\nprint(a + b)\n```',
    suyLuan: 'Vì phép cộng có tính giao hoán và kết hợp, thứ tự cộng không ảnh hưởng kết quả.',
    testCase: 'a=5, b=3 → S=8. a=-2, b=7 → S=5. a=0, b=0 → S=0.',
    kiemChung: 'Kiểm tra bằng phép trừ: S - a = b thì đúng.',
    ngoaiLe: 'Số vô cùng (Infinity) + số hữu hạn = Infinity. NaN + bất kỳ = NaN.',
    caseKinhNghiem: 'Khi cộng số lớn, cần chú ý tràn số (overflow) trong ngôn ngữ có giới hạn kiểu int.',
    quanHe: [],
    nguonPhienBan: 'Toán học cơ bản — v1.0',
    keywords: ['cộng', 'phép cộng', 'tính tổng', 'số học', 'addition', 'sum'],
    qualityScore: 95,
  },
  {
    nguyenLy: 'Phép nhân hai số: tích của a và b là kết quả của việc cộng a với chính nó b lần.',
    quyTac: 'a × b = b × a. a × 1 = a. a × 0 = 0. a × (-b) = -(a × b).',
    dieuKien: 'a và b là số.',
    cayQuyetDinh: 'Cùng dấu → tích dương. Khác dấu → tích âm.',
    phuongPhap: 'Nhân từng chữ số theo hàng, cộng các tích riêng có dịch vị trí.',
    thuatToan: 'B1: Nhập a, b. B2: P = a × b. B3: Xuất P.',
    workflow: 'Input: a, b → Xử lý: P = a × b → Output: P.\n\n```python\na = 4\nb = 6\nprint(a * b)\n```',
    suyLuan: 'Phép nhân là phép cộng lặp.',
    testCase: 'a=4, b=6 → P=24. a=-2, b=5 → P=-10. a=0, b=100 → P=0.',
    kiemChung: 'P / a = b (khi a ≠ 0) thì đúng.',
    ngoaiLe: 'Nhân với 0 luôn cho 0. Nhân với NaN cho NaN.',
    caseKinhNghiem: 'Trong lập trình, phép nhân số nguyên lớn có thể tràn.',
    quanHe: [],
    nguonPhienBan: 'Toán học cơ bản — v1.0',
    keywords: ['nhân', 'phép nhân', 'tích', 'multiplication', 'product'],
    qualityScore: 95,
  },
  {
    nguyenLy: 'Phép chia hai số: thương của a chia b là số c mà b × c = a (với b ≠ 0).',
    quyTac: 'a / 1 = a. a / a = 1 (a ≠ 0). 0 / b = 0 (b ≠ 0). Không chia được cho 0.',
    dieuKien: 'b ≠ 0. a, b là số.',
    cayQuyetDinh: 'Nếu b = 0 → lỗi. Nếu a = 0 → kết quả 0. Ngược lại → chia bình thường.',
    phuongPhap: 'Chia từ trái sang phải, hạ từng chữ số, trừ dần.',
    thuatToan: 'B1: Nhập a, b. B2: Nếu b = 0 → báo lỗi. B3: Q = a / b. B4: Xuất Q.',
    workflow: 'Input: a, b → Kiểm tra b ≠ 0 → Q = a / b → Output.\n\n```python\na = 10\nb = 2\nif b == 0:\n    print("Không chia được cho 0")\nelse:\n    print(a / b)\n```',
    suyLuan: 'Phép chia là phép nhân ngược.',
    testCase: 'a=10, b=2 → Q=5. a=7, b=2 → Q=3.5. b=0 → lỗi.',
    kiemChung: 'Q × b = a thì đúng.',
    ngoaiLe: 'Chia cho 0 → lỗi. 0/0 → không xác định.',
    caseKinhNghiem: 'Trong Python 3, a / b luôn trả float. Dùng // để chia lấy nguyên.',
    quanHe: [],
    nguonPhienBan: 'Toán học cơ bản — v1.0',
    keywords: ['chia', 'phép chia', 'thương', 'division', 'quotient'],
    qualityScore: 95,
  },
];

async function main() {
  const shouldClear = process.argv.includes('--clear');

  console.log('🐉 Rồng Thần — Seed TIP');
  console.log('');

  try {
    await connectDB2();
    const Tip = getTipModel();

    if (shouldClear) {
      const result = await Tip.deleteMany({});
      console.log(`🗑️  Đã xóa ${result.deletedCount} TIP cũ`);
    }

    const existing = await Tip.countDocuments({});
    if (existing > 0 && !shouldClear) {
      console.log(`ℹ️  Đã có ${existing} TIP. Dùng --clear để nạp lại.`);
      await disconnectDB2();
      return;
    }

    console.log(`📥 Đang nạp ${SAMPLE_TIPS.length} TIP mẫu...`);
    const inserted = await Tip.insertMany(SAMPLE_TIPS);

    console.log('');
    console.log('═══════════════════════════════════════');
    console.log(`✅ Đã nạp ${inserted.length} TIP vào Kho 2`);
    inserted.forEach((t, i) => {
      console.log(`   [${i + 1}] ${t.nguyenLy.slice(0, 60)}...`);
    });
    console.log('═══════════════════════════════════════');

  } catch (err) {
    console.error('❌ Lỗi:', err.message);
    process.exit(1);
  } finally {
    await disconnectDB2();
  }
}

main();