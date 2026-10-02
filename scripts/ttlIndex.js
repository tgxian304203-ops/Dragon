/* ═══════════════════════════════════════════════════════════════
   🗑️ TTL INDEX (SC4, H39)
   Cách dùng:
     node scripts/ttlIndex.js
     node scripts/ttlIndex.js --create 90
     node scripts/ttlIndex.js --drop
   ═══════════════════════════════════════════════════════════════ */

require('dotenv').config();

const { connectDB1, disconnectDB1 } = require('../src/config/db1');
const mongoose = require('mongoose');

async function main() {
  const args = process.argv.slice(2);
  const isCreate = args.includes('--create');
  const isDrop   = args.includes('--drop');

  const daysArg = args.find((a) => /^\d+$/.test(a));
  const days = daysArg ? parseInt(daysArg, 10) : 90;

  console.log('🐉 Rồng Thần — TTL Index Kho 1');
  console.log('');

  try {
    await connectDB1();

    const db = mongoose.connection.db;
    const collection = db.collection('messages');

    const indexes = await collection.indexes();
    const ttlIndexes = indexes.filter((i) => i.expireAfterSeconds != null);

    console.log('📋 Index hiện tại:');
    indexes.forEach((i) => {
      const note = i.expireAfterSeconds != null ? ` [TTL ${i.expireAfterSeconds}s]` : '';
      console.log(`   - ${i.name}${note}`);
    });
    console.log('');

    if (isDrop) {
      if (ttlIndexes.length === 0) {
        console.log('ℹ️  Không có TTL index để xóa.');
        return;
      }
      for (const idx of ttlIndexes) {
        await collection.dropIndex(idx.name);
        console.log(`🗑️  Đã xóa: ${idx.name}`);
      }
      return;
    }

    if (isCreate) {
      if (days < 1) {
        console.error('❌ Số ngày phải >= 1');
        process.exit(1);
      }

      const seconds = days * 24 * 60 * 60;

      for (const idx of ttlIndexes) {
        await collection.dropIndex(idx.name);
        console.log(`🗑️  Đã xóa TTL cũ: ${idx.name}`);
      }

      await collection.createIndex(
        { createdAt: 1 },
        { expireAfterSeconds: seconds, name: 'ttl_createdAt' }
      );

      console.log('');
      console.log('═══════════════════════════════════════');
      console.log(`✅ Đã tạo TTL index`);
      console.log(`   Field: createdAt`);
      console.log(`   Hết hạn sau: ${days} ngày`);
      console.log('═══════════════════════════════════════');
      return;
    }

    console.log('ℹ️  Chưa có hành động. Dùng:');
    console.log('   node scripts/ttlIndex.js --create 90');
    console.log('   node scripts/ttlIndex.js --drop');

  } catch (err) {
    console.error('❌ Lỗi:', err.message);
    process.exit(1);
  } finally {
    await disconnectDB1();
  }
}

main();