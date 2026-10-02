/* ═══════════════════════════════════════════════════════════════
   🔐 AUTH SERVICE
   ═══════════════════════════════════════════════════════════════ */

const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { JWT_SECRET } = require('../config/constants');

const SALT_ROUNDS = 10;

async function hashPassword(plain) {
  if (!plain) throw new Error('Password rỗng');
  return bcrypt.hash(plain, SALT_ROUNDS);
}

async function comparePassword(plain, hash) {
  if (!plain || !hash) return false;
  return bcrypt.compare(plain, hash);
}

function signToken(payload) {
  if (!JWT_SECRET) throw new Error('Thiếu JWT_SECRET');
  // AU5: JWT KHÔNG hết hạn — không truyền expiresIn
  return jwt.sign(payload, JWT_SECRET);
}

module.exports = { hashPassword, comparePassword, signToken };