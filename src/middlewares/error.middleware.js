/* ═══════════════════════════════════════════════════════════════
   ⚠️ ERROR MIDDLEWARE (MW2)
   ═══════════════════════════════════════════════════════════════ */

const logger = require('../utils/logger');

function notFoundHandler(req, res) {
  res.status(404).json({
    error: 'Endpoint không tồn tại',
    path: req.path,
    method: req.method,
  });
}

function errorHandler(err, req, res, next) {
  const status = err.status || err.statusCode || 500;

  if (status >= 500) {
    logger.error('Server error:', err.message);
    logger.error(err.stack);
  } else {
    logger.warn('Client error:', err.message);
  }

  const response = { error: err.message || 'Lỗi server', status };
  if (process.env.NODE_ENV !== 'production') response.stack = err.stack;

  res.status(status).json(response);
}

function asyncHandler(fn) {
  return (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
}

module.exports = { notFoundHandler, errorHandler, asyncHandler };