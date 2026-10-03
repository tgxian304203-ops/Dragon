/* ═══════════════════════════════════════════════════════════════
   🧠 FEEDBACK LOOP — Rồng Thần tự học từ lỗi
   - recordSuccess(tipId): TIP trả lời thành công
   - recordFail(tipId, reason): TIP trả lời thất bại
   - recordUse(tipId): TIP được chọn để trả lời (dù chưa biết kết quả)
   - analyze(): chạy định kỳ — đánh dấu TIP kém, gộp TIP trùng
   ═══════════════════════════════════════════════════════════════ */

const { getTipModel } = require('../../models/tip.model');
const logger = require('../../utils/logger');

/* ═══════════════════════════════════════════════════════════════
   NGƯỠNG ĐÁNH GIÁ
   ═══════════════════════════════════════════════════════════════ */

// TIP dùng >= 10 lần mới bắt đầu đánh giá
const MIN_USAGE_FOR_EVAL = 10;

// successRate < 0.3 → đánh dấu deprecated
const DEPRECATED_SUCCESS_RATE = 0.3;

// successRate >= 0.8 → TIP tốt (tăng qualityScore)
const GOOD_SUCCESS_RATE = 0.8;

/* ═══════════════════════════════════════════════════════════════
   RECORD — ghi nhận sử dụng TIP
   ═══════════════════════════════════════════════════════════════ */

/**
 * Đánh dấu TIP vừa được chọn để trả lời (chưa biết thành công hay không).
 */
async function recordUse(tipId) {
  if (!tipId) return;
  try {
    const Tip = getTipModel();
    await Tip.updateOne(
      { _id: tipId },
      {
        $inc: { usageCount: 1 },
        $set: { lastUsedAt: new Date() },
      }
    );
  } catch (err) {
    logger.warn(`feedback.recordUse lỗi: ${err.message}`);
  }
}

/**
 * Đánh dấu TIP trả lời thành công.
 */
async function recordSuccess(tipId, meta = {}) {
  if (!tipId) return;
  try {
    const Tip = getTipModel();
    await Tip.updateOne(
      { _id: tipId },
      {
        $inc: { successCount: 1 },
        $set: { lastUsedAt: new Date() },
      }
    );
    logger.debug(`📈 TIP ${tipId} success (${meta.source || 'unknown'})`);
  } catch (err) {
    logger.warn(`feedback.recordSuccess lỗi: ${err.message}`);
  }
}

/**
 * Đánh dấu TIP trả lời thất bại.
 */
async function recordFail(tipId, reason = '') {
  if (!tipId) return;
  try {
    const Tip = getTipModel();
    await Tip.updateOne(
      { _id: tipId },
      {
        $inc: { failCount: 1 },
        $set: { lastUsedAt: new Date() },
      }
    );
    logger.debug(`📉 TIP ${tipId} fail: ${reason}`);
  } catch (err) {
    logger.warn(`feedback.recordFail lỗi: ${err.message}`);
  }
}

/**
 * Ghi log câu hỏi khó — Não trái fail 3 lần.
 * Lưu vào collection riêng để phân tích sau.
 */
async function recordHardProblem(problem, intent, error) {
  if (!problem) return;
  try {
    logger.warn(`🧩 Hard problem [${intent}]: "${problem.slice(0, 80)}" — ${error}`);
    // TODO: có thể lưu vào Kho 2 collection "hard_problems" để Não trái đọc lại
  } catch (err) {
    logger.warn(`feedback.recordHardProblem lỗi: ${err.message}`);
  }
}

/* ═══════════════════════════════════════════════════════════════
   ANALYZE — chạy định kỳ 24h
   ═══════════════════════════════════════════════════════════════ */

/**
 * Phân tích toàn bộ TIP trong Kho 2:
 * 1. Đánh dấu TIP kém (successRate thấp + usage đủ lớn) → isDeprecated
 * 2. Tăng qualityScore cho TIP tốt
 */
async function analyze() {
  const start = Date.now();
  logger.info('🧠 Feedback analyze bắt đầu...');

  try {
    const Tip = getTipModel();
    const allTips = await Tip.find({}).lean();
    logger.info(`🧠 Có ${allTips.length} TIP cần phân tích`);

    let deprecated = 0;
    let promoted = 0;
    let kept = 0;

    for (const tip of allTips) {
      const usage = tip.usageCount || 0;
      const success = tip.successCount || 0;
      const fail = tip.failCount || 0;
      const total = success + fail;
      const successRate = total > 0 ? success / total : null;

      /* ═══ Chưa đủ dữ liệu → bỏ qua ═══ */
      if (usage < MIN_USAGE_FOR_EVAL || total === 0) {
        kept++;
        continue;
      }

      /* ═══ TIP kém → deprecated ═══ */
      if (successRate !== null && successRate < DEPRECATED_SUCCESS_RATE) {
        if (!tip.isDeprecated) {
          await Tip.updateOne(
            { _id: tip._id },
            {
              $set: {
                isDeprecated: true,
                deprecatedReason: `successRate=${(successRate * 100).toFixed(1)}% < ${DEPRECATED_SUCCESS_RATE * 100}% (usage=${usage})`,
              },
            }
          );
          deprecated++;
          logger.warn(`☠️ TIP ${tip._id} deprecated: ${(successRate * 100).toFixed(1)}% success`);
        }
        continue;
      }

      /* ═══ TIP tốt → tăng qualityScore ═══ */
      if (successRate !== null && successRate >= GOOD_SUCCESS_RATE) {
        const newQuality = Math.min(100, (tip.qualityScore || 0) + 5);
        if (newQuality > (tip.qualityScore || 0)) {
          await Tip.updateOne(
            { _id: tip._id },
            { $set: { qualityScore: newQuality } }
          );
          promoted++;
        }
        continue;
      }

      kept++;
    }

    logger.success(
      `🧠 Feedback analyze xong (${Date.now() - start}ms): ` +
      `deprecated=${deprecated}, promoted=${promoted}, kept=${kept}`
    );

    return { deprecated, promoted, kept, total: allTips.length };
  } catch (err) {
    logger.error('feedback.analyze lỗi:', err.message);
    return { error: err.message };
  }
}

/* ═══════════════════════════════════════════════════════════════
   EXPORTS
   ═══════════════════════════════════════════════════════════════ */

module.exports = {
  recordUse,
  recordSuccess,
  recordFail,
  recordHardProblem,
  analyze,
  MIN_USAGE_FOR_EVAL,
  DEPRECATED_SUCCESS_RATE,
  GOOD_SUCCESS_RATE,
};