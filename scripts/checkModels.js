/* ═══════════════════════════════════════════════════════════════
   🔎 CHECK MODELS (SC3)
   Cách dùng:
     node scripts/checkModels.js
     node scripts/checkModels.js --side left
   ═══════════════════════════════════════════════════════════════ */

require('dotenv').config();

const { connectDB1, disconnectDB1 } = require('../src/config/db1');
const BrainKey = require('../src/models/brainKey.model');
const { doModel } = require('../src/core/brains/doModel');

async function main() {
  const sideArg = process.argv.indexOf('--side');
  const sideFilter = sideArg !== -1 ? process.argv[sideArg + 1] : null;

  console.log('🐉 Rồng Thần — Check Models');
  if (sideFilter) console.log(`📌 Chỉ kiểm: Não ${sideFilter}`);
  console.log('');

  try {
    await connectDB1();

    const query = { alive: true };
    if (sideFilter && ['left', 'right'].includes(sideFilter)) query.side = sideFilter;

    const keys = await BrainKey.find(query).lean();

    if (keys.length === 0) {
      console.log('ℹ️  Không có key để kiểm.');
      return;
    }

    console.log(`🔍 ${keys.length} key cần kiểm tra\n`);

    let okCount = 0;
    let failCount = 0;

    for (const key of keys) {
      const short = String(key._id).slice(-6);
      const label = `[${key.side}/${key.provider}#${short}]`;

      try {
        const { models, count } = await doModel(key.provider, key.keyValue);

        await BrainKey.updateOne(
          { _id: key._id },
          { $set: { availableModels: models, quotaUpdatedAt: new Date() } }
        );

        console.log(`${label} ✅ ${count} model FREE`);
        console.log(`   Top 5: ${models.slice(0, 5).join(', ') || '(không có)'}\n`);
        okCount++;
      } catch (err) {
        console.log(`${label} ❌ ${err.message}\n`);

        if (/40[13]/.test(err.message)) {
          await BrainKey.updateOne({ _id: key._id }, { $set: { alive: false } });
          console.log(`   → Đã đánh dấu alive=false\n`);
        }
        failCount++;
      }
    }

    console.log('═══════════════════════════════════════');
    console.log(`✅ OK: ${okCount}   ❌ Fail: ${failCount}`);
    console.log('═══════════════════════════════════════');

  } catch (err) {
    console.error('❌ Lỗi:', err.message);
    process.exit(1);
  } finally {
    await disconnectDB1();
  }
}

main();