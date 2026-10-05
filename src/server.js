/* ═══════════════════════════════════════════════════════════════
   🐉 RỒNG THẦN — SERVER KHỞI ĐỘNG
   - Khởi động 2 DB
   - Auto update models
   - Cleanup imageCache/voiceCache/fileCache
   - Cleanup modelCache + feedback.analyze()
   - [MỚI] Seed cây gốc khi khởi động
   ═══════════════════════════════════════════════════════════════ */

require('dotenv').config();

const express = require('express');
const cors = require('cors');
const path = require('path');
const cookieParser = require('cookie-parser');

const { connectDB1, disconnectDB1 } = require('./config/db1');
const { connectDB2, disconnectDB2 } = require('./config/db2');
const { PORT, NODE_ENV } = require('./config/constants');

const { notFoundHandler, errorHandler } = require('./middlewares/error.middleware');
const { identifyGuest } = require('./middlewares/guest.middleware');

const app = express();

/* ═══ MIDDLEWARES CƠ BẢN ═══ */
app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());

/* ═══ STATIC ═══ */
app.use(express.static(path.join(__dirname, '..', 'public')));

/* ═══ GUEST IDENTIFY ═══ */
app.use(identifyGuest);

/* ═══ HEALTH ═══ */
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'Rồng Thần',
    env: NODE_ENV,
    timestamp: new Date().toISOString(),
  });
});

/* ═══ ROUTE /share/:slug ═══ */
app.get('/share/:slug', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'share-view.html'));
});

/* ═══ MOUNT ROUTES ═══ */
app.use('/api/auth',     require('./routes/auth.routes'));
app.use('/api/guest',    require('./routes/guest.routes'));
app.use('/api/brain',    require('./routes/brain.routes'));
app.use('/api/chat',     require('./routes/chat.routes'));
app.use('/api/project',  require('./routes/project.routes'));
app.use('/api/share',    require('./routes/share.routes'));
app.use('/api/recent',   require('./routes/recent.routes'));
app.use('/api/quota',    require('./routes/quota.routes'));
app.use('/api/upload',   require('./routes/upload.routes'));
app.use('/api/voice',    require('./routes/voice.routes'));
app.use('/api/file',     require('./routes/file.routes'));
app.use('/api/settings', require('./routes/settings.routes'));

/* ═══ 404 + ERROR ═══ */
app.use(notFoundHandler);
app.use(errorHandler);

/* ═══ KHỞI ĐỘNG ═══ */
let server = null;
let modelCacheCleanupTimer = null;
let feedbackAnalyzeTimer = null;

const MODEL_CACHE_CLEANUP_MS = 30 * 60 * 1000;      // 30 phút
const FEEDBACK_ANALYZE_MS = 24 * 60 * 60 * 1000;    // 24 giờ

async function start() {
  try {
    console.log('🐉 Rồng Thần đang khởi động...');
    console.log(`📌 Môi trường: ${NODE_ENV}`);

    await Promise.all([connectDB1(), connectDB2()]);

    /* ═══ [MỚI] SEED CÂY GỐC ═══ */
    try {
      const { seedRootTree } = require('./data/rootTreeSeed');
      const result = await seedRootTree();
      if (result.seeded > 0) {
        console.log(`🌳 Đã seed ${result.seeded} nhánh vào cây gốc`);
      } else {
        console.log(`🌳 Cây gốc đã có ${result.existing} nhánh — bỏ qua seed`);
      }
    } catch (err) {
      console.warn('⚠️ Seed cây gốc lỗi:', err.message);
    }

    /* ═══ Auto update models ═══ */
    const { startAutoUpdate } = require('./core/brains/autoUpdateModels');
    startAutoUpdate();

    /* ═══ Cleanup services ═══ */
    require('./services/imageCache.service').startCleanup();
    require('./services/voiceCache.service').startCleanup();
    require('./services/fileCache.service').startCleanup();

    /* ═══ Cleanup modelCache định kỳ ═══ */
    const modelCache = require('./core/brains/modelCache');
    modelCacheCleanupTimer = setInterval(() => {
      try {
        modelCache.cleanup();
        console.log('🧹 modelCache.cleanup() chạy xong');
      } catch (err) {
        console.error('❌ modelCache.cleanup() lỗi:', err.message);
      }
    }, MODEL_CACHE_CLEANUP_MS);
    console.log(`🧹 Cleanup modelCache bật — mỗi ${MODEL_CACHE_CLEANUP_MS / 1000 / 60} phút`);

    /* ═══ Feedback analyze định kỳ ═══ */
    try {
      const feedback = require('./core/brains/feedback');
      feedbackAnalyzeTimer = setInterval(() => {
        feedback.analyze().catch((err) => {
          console.error('❌ feedback.analyze() lỗi:', err.message);
        });
      }, FEEDBACK_ANALYZE_MS);
      console.log(`🧠 Feedback analyze bật — mỗi ${FEEDBACK_ANALYZE_MS / 1000 / 60 / 60} giờ`);
    } catch (err) {
      console.warn('⚠️ Không khởi động được feedback:', err.message);
    }

    server = app.listen(PORT, () => {
      console.log(`✅ Rồng Thần sẵn sàng tại http://localhost:${PORT}`);
    });
  } catch (err) {
    console.error('❌ Không khởi động được:', err.message);
    process.exit(1);
  }
}

/* ═══ SHUTDOWN ═══ */
async function shutdown(signal) {
  console.log(`\n🛑 Tín hiệu ${signal} — đang tắt...`);

  try {
    const { stopAutoUpdate } = require('./core/brains/autoUpdateModels');
    stopAutoUpdate();
  } catch {}

  try { require('./services/imageCache.service').stopCleanup(); } catch {}
  try { require('./services/voiceCache.service').stopCleanup(); } catch {}
  try { require('./services/fileCache.service').stopCleanup(); } catch {}

  if (modelCacheCleanupTimer) {
    clearInterval(modelCacheCleanupTimer);
    modelCacheCleanupTimer = null;
  }
  if (feedbackAnalyzeTimer) {
    clearInterval(feedbackAnalyzeTimer);
    feedbackAnalyzeTimer = null;
  }

  if (server) server.close(() => console.log('✅ HTTP server đã tắt'));

  try {
    await Promise.all([disconnectDB1(), disconnectDB2()]);
    console.log('✅ Đã ngắt kết nối 2 MongoDB');
  } catch (err) {
    console.error('❌ Lỗi ngắt DB:', err.message);
  }

  process.exit(0);
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT',  () => shutdown('SIGINT'));

start();

module.exports = app;