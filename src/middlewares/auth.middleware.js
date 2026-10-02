/* ═══════════════════════════════════════════════════════════════
   🔐 AUTH MIDDLEWARE (MW3)
   ═══════════════════════════════════════════════════════════════ */

const jwt = require('jsonwebtoken');
const { JWT_SECRET } = require('../config/constants');
const logger = require('../utils/logger');

function extractToken(req) {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) return authHeader.slice(7);
  if (req.cookies && req.cookies.token) return req.cookies.token;
  return null;
}

function verifyToken(token) {
  if (!token || !JWT_SECRET) return null;
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (err) {
    logger.debug('JWT verify fail:', err.message);
    return null;
  }
}

function requireAuth(req, res, next) {
  const payload = verifyToken(extractToken(req));
  if (!payload) return res.status(401).json({ error: 'Chưa đăng nhập' });
  req.user = payload;
  next();
}

function optionalAuth(req, res, next) {
  req.user = verifyToken(extractToken(req)) || null;
  next();
}

module.exports = { requireAuth, optionalAuth };