/* ═══════════════════════════════════════════════════════════════
   🗄️ KHO 1 — MongoDB 1 (User + Hội thoại + Project + Share)
   ═══════════════════════════════════════════════════════════════ */

const mongoose = require('mongoose');

let isConnected = false;

async function connectDB1() {
  if (isConnected) return;

  const uri = process.env.MONGO1_URI;
  if (!uri) throw new Error('Thiếu MONGO1_URI');

  try {
    await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 10000,
      maxPoolSize: 10,
      minPoolSize: 2,
      socketTimeoutMS: 45000,
    });

    isConnected = true;
    console.log('✅ Kho 1 (User + Hội thoại) đã kết nối');
    console.log(`   Database: ${mongoose.connection.db.databaseName}`);
  } catch (err) {
    console.error('❌ Kho 1 kết nối thất bại:', err.message);
    throw err;
  }
}

async function disconnectDB1() {
  if (isConnected) {
    await mongoose.disconnect();
    isConnected = false;
  }
}

module.exports = { connectDB1, disconnectDB1 };