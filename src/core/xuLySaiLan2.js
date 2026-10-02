/* ═══════════════════════════════════════════════════════════════
   🛠️ XỬ LÝ SAI LẦN 2 — Não trái + Não phải (T18)
   ═══════════════════════════════════════════════════════════════ */

const naoTrai = require('./brains/naoTrai');
const naoPhai = require('./brains/naoPhai');
const { callModel } = require('./brains/goiModel');
const { testCode } = require('./pistonTest');
const logger = require('../utils/logger');

async function xuLySaiLan2({ problem, failedCode, failedLanguage, errors, tip, owner }) {
  logger.warn(`🛠️ Sai lần 2 — Não trái + Não phải can thiệp`);

  const errorsText = errors.map((e, i) => `Lần ${e.attempt || i + 1}: ${e.error}`).join('\n');

  const problemForNao =
    `Vấn đề gốc: ${problem}\n\n` +
    `Code lỗi:\n\`\`\`${failedLanguage}\n${failedCode}\n\`\`\`\n\n` +
    `Lỗi:\n${errorsText}\n\n` +
    `TIP cũ:\n${tip.nguyenLy || ''}\n\n` +
    `Hãy phân tích lỗi, tìm nguyên nhân gốc, đề xuất cách sửa.`;

  let newTip;
  try {
    const traiResult = await naoTrai.phanTich({
      problem: problemForNao,
      context: '',
      relatedTIPs: [],
      webResults: '',
      owner,
    });
    newTip = traiResult.tip;
  } catch (err) {
    logger.error('Não trái không cứu được:', err.message);
    return { success: false };
  }

  let evaluation;
  try {
    const phaiResult = await naoPhai.kiemChung({
      tip: newTip,
      originalProblem: problem,
      owner,
    });
    evaluation = phaiResult.evaluation;
  } catch (err) {
    logger.error('Não phải không kiểm được:', err.message);
    return { success: false };
  }

  if (evaluation.needSupplement) {
    logger.warn(`Não phải báo thiếu trường → không cứu được`);
    return { success: false };
  }

  const codePrompt =
    `Vấn đề: ${problem}\n\n` +
    `TIP mới:\n` +
    `Nguyên lý: ${newTip.nguyenLy}\n` +
    `Phương pháp: ${newTip.phuongPhap}\n` +
    `Thuật toán: ${newTip.thuatToan}\n\n` +
    `Code cũ:\n\`\`\`${failedLanguage}\n${failedCode}\n\`\`\`\n\n` +
    `Sửa code. Chỉ trả JSON: {"language": "...", "code": "...", "explain": "..."}`;

  let rescued;
  try {
    const result = await callModel({
      side: 'left',
      userId: owner.userId,
      guestSessionId: owner.guestSessionId,
      messages: [
        { role: 'system', content: 'Bạn là Não trái — sửa code. Chỉ trả JSON: {"language": "...", "code": "...", "explain": "..."}.' },
        { role: 'user', content: codePrompt },
      ],
      options: { temperature: 0.2, maxTokens: 4096 },
    });
    rescued = parseCodeResponse(result.text);
  } catch (err) {
    logger.error('Không tạo được code mới:', err.message);
    return { success: false };
  }

  if (!rescued.code) return { success: false };

  const testResult = await testCode({
    code: rescued.code,
    language: rescued.language,
  });

  if (testResult.success) {
    logger.success(`🛠️ Cứu thành công`);
    return {
      success: true,
      code: rescued.code,
      language: rescued.language,
      output: testResult.stdout,
      explain: rescued.explain || 'Đã sửa thành công',
    };
  }

  return {
    success: false,
    code: rescued.code,
    language: rescued.language,
    output: testResult.stdout,
    error: testResult.error,
  };
}

function parseCodeResponse(raw) {
  if (!raw) return { language: 'python', code: '', explain: '' };

  let text = String(raw).trim();
  const block = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  if (block) text = block[1].trim();

  try {
    const obj = JSON.parse(text);
    return {
      language: (obj.language || 'python').toLowerCase(),
      code: obj.code || '',
      explain: obj.explain || '',
    };
  } catch {
    const first = text.indexOf('{');
    const last = text.lastIndexOf('}');
    if (first !== -1 && last > first) {
      try {
        const obj = JSON.parse(text.slice(first, last + 1));
        return {
          language: (obj.language || 'python').toLowerCase(),
          code: obj.code || '',
          explain: obj.explain || '',
        };
      } catch {}
    }
    return { language: 'python', code: text, explain: '' };
  }
}

module.exports = { xuLySaiLan2 };