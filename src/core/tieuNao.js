/* ═══════════════════════════════════════════════════════════════
   🧠 TIỂU NÃO — T17: 6 bước phân tích lỗi → sửa → test lại
   ═══════════════════════════════════════════════════════════════ */

const { testCode } = require('./pistonTest');
const xuLySaiLan2 = require('./xuLySaiLan2');
const logger = require('../utils/logger');

async function xuLy({ tip, problem, userRequestType, owner, context = null }) {
  if (!tip || !tip.nguyenLy) throw new Error('TIP không hợp lệ');
  if (!problem || problem.trim() === '') throw new Error('Vấn đề rỗng');
  if (!['code', 'no_code'].includes(userRequestType)) throw new Error('userRequestType không hợp lệ');

  logger.info(`🧠 Tiểu não [${userRequestType}]: "${problem.slice(0, 60)}..."`);

  if (userRequestType === 'no_code') return xuLyKhongCode({ tip, problem });
  return await xuLyCoCode({ tip, problem, owner });
}

function xuLyKhongCode({ tip, problem }) {
  const parts = [];
  parts.push(`📌 **Nguyên lý:**\n${tip.nguyenLy || '(chưa có)'}`);
  if (tip.quyTac) parts.push(`\n📏 **Quy tắc:**\n${tip.quyTac}`);
  if (tip.dieuKien) parts.push(`\n🔗 **Điều kiện:**\n${tip.dieuKien}`);
  if (tip.cayQuyetDinh) parts.push(`\n🌳 **Cây quyết định:**\n${tip.cayQuyetDinh}`);
  if (tip.phuongPhap) parts.push(`\n🛠️ **Phương pháp:**\n${tip.phuongPhap}`);
  if (tip.thuatToan) parts.push(`\n⚙️ **Thuật toán:**\n${tip.thuatToan}`);
  if (tip.workflow) parts.push(`\n🔄 **Workflow:**\n${tip.workflow}`);
  if (tip.suyLuan) parts.push(`\n🧠 **Suy luận:**\n${tip.suyLuan}`);
  if (tip.testCase) parts.push(`\n🧪 **Test case:**\n${tip.testCase}`);
  if (tip.kiemChung) parts.push(`\n🔍 **Kiểm chứng:**\n${tip.kiemChung}`);
  if (tip.ngoaiLe) parts.push(`\n⚠️ **Ngoại lệ:**\n${tip.ngoaiLe}`);
  if (tip.caseKinhNghiem) parts.push(`\n💡 **Case:**\n${tip.caseKinhNghiem}`);
  if (tip.nguonPhienBan) parts.push(`\n📚 **Nguồn:** ${tip.nguonPhienBan}`);

  return {
    answer: parts.join('\n'),
    type: 'no_code',
    meta: { tipId: tip._id?.toString() || null },
  };
}

async function xuLyCoCode({ tip, problem, owner }) {
  const nguyenLy = tip.nguyenLy || '';
  const allBlocks = extractAllCodeBlocks(tip);

  if (allBlocks.length === 0) {
    logger.warn(`TIP không có code → Não trái + Não phải`);
    const rescue = await xuLySaiLan2.xuLySaiLan2({
      problem, failedCode: '', failedLanguage: 'python',
      errors: [{ attempt: 1, error: 'TIP không có code block' }],
      tip, owner,
    });
    if (rescue.success && rescue.code) return buildRescueResult(rescue, tip);
    return {
      answer: `⚠️ TIP không có code và Não trái + Não phải cũng không tạo được.\n\n📌 Nguyên lý: ${nguyenLy}`,
      type: 'code', code: null, language: null, output: null,
      meta: { tipId: tip._id?.toString() || null },
    };
  }

  let lastError = null;
  let lastBlock = allBlocks[0];

  for (let i = 0; i < allBlocks.length; i++) {
    const block = allBlocks[i];
    lastBlock = block;

    logger.info(`🧪 Test block ${i + 1}/${allBlocks.length} (${block.language})`);

    const testResult = await testCode({ code: block.code, language: block.language });

    if (testResult.success) {
      return {
        answer: buildCodeAnswer(block, testResult),
        type: 'code', code: block.code, language: block.language,
        output: testResult.stdout, attempts: i + 1,
        meta: { tipId: tip._id?.toString() || null },
      };
    }

    lastError = testResult.error;
    logger.warn(`Block ${i + 1} FAIL: ${testResult.error?.slice(0, 100)}`);
  }

  logger.info(`🔍 T17: Phân tích lỗi → sửa → test lại`);

  const analysis = phanTichLoi(lastError, tip);
  logger.info(`📍 Vị trí: ${analysis.viTri}`);
  logger.info(`🧩 Nguyên nhân: ${analysis.nguyenNhan}`);

  const fix = timCachSua(lastBlock, tip, analysis);
  logger.info(`🔧 Cách sửa: ${fix.cachSua}`);

  if (fix.code && fix.code !== lastBlock.code) {
    logger.info(`🛠️ Sửa code → test lại`);

    const fixTest = await testCode({ code: fix.code, language: fix.language });

    if (fixTest.success) {
      logger.success(`✅ Sửa OK`);
      return {
        answer: buildCodeAnswer({ ...fix, explain: fix.explain }, fixTest),
        type: 'code', code: fix.code, language: fix.language,
        output: fixTest.stdout, attempts: allBlocks.length + 1,
        fixed: true,
        meta: { tipId: tip._id?.toString() || null },
      };
    }

    lastError = fixTest.error;
    logger.warn(`Sửa vẫn fail: ${lastError}`);
  }

  logger.warn(`❌ Sai lần 2 → Não trái + Não phải (T18)`);

  const rescue = await xuLySaiLan2.xuLySaiLan2({
    problem,
    failedCode: lastBlock.code,
    failedLanguage: lastBlock.language,
    errors: [{ attempt: 1, error: lastError || 'unknown' }],
    tip, owner,
  });

  if (rescue.success && rescue.code) return buildRescueResult(rescue, tip);

  return {
    answer: `⚠️ Code không chạy được sau 2 lần thử.\n\n📍 Vị trí lỗi: ${analysis.viTri}\n🧩 Nguyên nhân: ${analysis.nguyenNhan}\n🔧 Cách sửa đã thử: ${fix.cachSua}\n\nLỗi cuối: ${lastError}\n\nCode:\n\`\`\`${lastBlock.language}\n${lastBlock.code}\n\`\`\``,
    type: 'code', code: lastBlock.code, language: lastBlock.language,
    output: '', attempts: allBlocks.length + 1, error: lastError,
    meta: { tipId: tip._id?.toString() || null },
  };
}

function phanTichLoi(error, tip) {
  const err = String(error || '');

  let viTri = 'không xác định';
  const lineMatch = err.match(/[Ll]ine\s+(\d+)/);
  if (lineMatch) viTri = `dòng ${lineMatch[1]}`;

  let nguyenNhan = 'lỗi runtime không xác định';
  const ngoaiLe = (tip.ngoaiLe || '').toLowerCase();

  if (/zerodivision|divided by zero|chia.*0/i.test(err)) {
    nguyenNhan = 'chia cho 0';
  } else if (/typeerror|không đúng kiểu/i.test(err)) {
    nguyenNhan = 'sai kiểu dữ liệu';
  } else if (/nameerror|not defined|không định nghĩa/i.test(err)) {
    nguyenNhan = 'biến chưa khai báo';
  } else if (/indexerror|out of range/i.test(err)) {
    nguyenNhan = 'truy cập mảng ngoài phạm vi';
  } else if (/syntaxerror|invalid syntax/i.test(err)) {
    nguyenNhan = 'lỗi cú pháp';
  } else if (ngoaiLe && err.toLowerCase().includes('exception')) {
    nguyenNhan = `ngoại lệ từ TIP: ${tip.ngoaiLe.slice(0, 100)}`;
  }

  return { viTri, nguyenNhan, rawError: err };
}

function timCachSua(block, tip, analysis) {
  if (!block || !block.code) return { code: null, language: 'python', cachSua: 'không có code' };

  const lang = block.language;

  let cachSua = 'không tìm được cách sửa';
  let code = null;

  if (!['python', 'javascript'].includes(lang)) {
    return { code: null, language: lang, cachSua: 'ngôn ngữ không hỗ trợ' };
  }

  const original = block.code;
  const hasTry = (lang === 'python' && /try\s*:/.test(original)) ||
                 (lang === 'javascript' && /try\s*\{/.test(original));

  if (hasTry) {
    return { code: null, language: lang, cachSua: 'đã có try/except — không wrap lại' };
  }

  if (lang === 'python') {
    const indented = original.split('\n').map((l) => '    ' + l).join('\n');
    code = `try:\n${indented}\nexcept Exception as e:\n    print("Lỗi:", e)`;
    cachSua = 'wrap try/except (theo ngoại lệ TIP)';
  } else if (lang === 'javascript') {
    const indented = original.split('\n').map((l) => '  ' + l).join('\n');
    code = `try {\n${indented}\n} catch (e) {\n  console.log("Lỗi:", e.message);\n}`;
    cachSua = 'wrap try/catch (theo ngoại lệ TIP)';
  }

  return { code, language: lang, cachSua, explain: `Sửa: ${cachSua}` };
}

function extractAllCodeBlocks(tip) {
  const sources = [
    tip.workflow || '', tip.thuatToan || '',
    tip.testCase || '', tip.caseKinhNghiem || '', tip.phuongPhap || '',
  ];

  const blocks = [];
  for (const src of sources) {
    if (!src) continue;
    const found = extractCodeBlocksFromText(src);
    blocks.push(...found);
  }

  if (blocks.length === 0) {
    for (const src of sources) {
      if (!src) continue;
      const plain = tryAsPlainCode(src);
      if (plain) blocks.push(plain);
    }
  }

  return blocks;
}

function extractCodeBlocksFromText(text) {
  const results = [];
  const re = /```(\w+)?\s*\n?([\s\S]*?)```/g;
  let match;
  while ((match = re.exec(text)) !== null) {
    const lang = (match[1] || 'python').toLowerCase();
    const code = (match[2] || '').trim();
    if (code.length < 5) continue;
    results.push({ language: normalizeLanguage(lang), code, explain: '' });
  }
  return results;
}

function tryAsPlainCode(text) {
  if (!text || text.trim().length < 10) return null;
  const trimmed = text.trim();
  const signals = [
    /def\s+\w+\s*\(/, /function\s+\w+\s*\(/, /print\s*\(/,
    /console\.log\s*\(/, /=\s*\[/, /if\s*\(.+\)\s*\{/,
    /for\s+\w+\s+in\s+/, /return\s+/,
  ];
  if (!signals.some((re) => re.test(trimmed))) return null;
  return { language: detectLanguage(trimmed), code: trimmed, explain: '' };
}

function normalizeLanguage(lang) {
  const map = {
    py: 'python', python3: 'python', js: 'javascript', node: 'javascript',
    ts: 'typescript', 'c++': 'cpp', cs: 'csharp', sh: 'bash', shell: 'bash',
  };
  return map[lang] || lang;
}

function detectLanguage(code) {
  if (/^\s*def\s+\w+\s*\(|print\s*\(/m.test(code)) return 'python';
  if (/^\s*function\s+\w+\s*\(|console\.log/m.test(code)) return 'javascript';
  if (/^\s*public\s+class|System\.out\.println/m.test(code)) return 'java';
  if (/^\s*#include|int\s+main\s*\(/m.test(code)) return 'cpp';
  return 'python';
}

function buildCodeAnswer(block, testResult) {
  const parts = [];
  if (block.explain) parts.push(block.explain, '');
  parts.push('```' + block.language);
  parts.push(block.code);
  parts.push('```');
  if (testResult.stdout && testResult.stdout.trim()) {
    parts.push('', `📤 **Output:**\n${testResult.stdout.trim()}`);
  }
  return parts.join('\n');
}

function buildRescueResult(rescue, tip) {
  return {
    answer: `🛠️ Sau khi Não trái + Não phải xử lý:\n\n${rescue.explain || ''}\n\n\`\`\`${rescue.language}\n${rescue.code}\n\`\`\`\n\n📤 Output: ${rescue.output || '(không có)'}`,
    type: 'code', code: rescue.code, language: rescue.language,
    output: rescue.output, attempts: 3, rescued: true,
    meta: { tipId: tip._id?.toString() || null },
  };
}

function tipCoCode(tip) {
  return extractAllCodeBlocks(tip).length > 0;
}

module.exports = {
  xuLy, xuLyKhongCode, xuLyCoCode,
  extractAllCodeBlocks, tipCoCode,
  phanTichLoi, timCachSua,
};