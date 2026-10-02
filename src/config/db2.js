/* ═══════════════════════════════════════════════════════════════
   🗄️ KHO 2 — MongoDB 2 (Kho tri thức / TIP)
   ═══════════════════════════════════════════════════════════════ */

const mongoose = require('mongoose');

let connection2 = null;

async function connectDB2() {
  if (connection2 && connection2.readyState === 1) return connection2;

  const uri = process.env.MONGO2_URI;
  if (!uri) throw new Error('Thiếu MONGO2_URI');

  try {
    connection2 = mongoose.createConnection(uri, {
      serverSelectionTimeoutMS: 10000,
      maxPoolSize: 10,
      minPoolSize: 2,
      socketTimeoutMS: 45000,
    });

    await connection2.asPromise();

    console.log('✅ Kho 2 (Tri thức / TIP) đã kết nối');
    console.log(`   Database: ${connection2.db.databaseName}`);

    return connection2;
  } catch (err) {
    console.error('❌ Kho 2 kết nối thất bại:', err.message);
    throw err;
  }
}

async function disconnectDB2() {
  if (connection2) {
    await connection2.close();
    connection2 = null;
  }
}

function getDB2() {
  if (!connection2 || connection2.readyState !== 1) {
    throw new Error('Kho 2 chưa kết nối');
  }
  return connection2;
}

module.exports = { connectDB2, disconnectDB2, getDB2 };