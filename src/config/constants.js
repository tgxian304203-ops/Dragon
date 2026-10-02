/* ═══════════════════════════════════════════════════════════════
   📌 HẰNG SỐ TOÀN DỰ ÁN
   ═══════════════════════════════════════════════════════════════ */

require('dotenv').config();

const PORT = Number(process.env.PORT) || 3000;
const NODE_ENV = process.env.NODE_ENV || 'development';

// JWT — AU5: không hết hạn
const JWT_SECRET = process.env.JWT_SECRET || '';

// Kho 1 — K1a, K1c
const MAX_USERS = 50;
const MAX_MESSAGES_PER_CONV = 1000;

// Ảnh — IA2, IA3
const IMAGE_TTL_MS = 5 * 60 * 1000;
const MAX_IMAGES_PER_USER = 3;

// Voice — VO5–VO8
const VOICE_TTL_MS = 5 * 60 * 1000;
const MAX_VOICES_PER_USER = 3;
const MAX_VOICE_SECONDS = 60;
const MAX_VOICE_SIZE_MB = 10;
const MAX_VOICE_SIZE_BYTES = MAX_VOICE_SIZE_MB * 1024 * 1024;

// File — FL4, FL5
const FILE_TTL_MS = 5 * 60 * 1000;
const RAM_THRESHOLD_MB = 400;
const RAM_THRESHOLD_BYTES = RAM_THRESHOLD_MB * 1024 * 1024;

// Model — TU6
const MODEL_UPDATE_INTERVAL_MS = 24 * 60 * 60 * 1000;

// Piston — H5
const PISTON_URL = process.env.PISTON_URL || 'https://emkc.org/api/v2/piston';

module.exports = {
  PORT, NODE_ENV, JWT_SECRET,
  MAX_USERS, MAX_MESSAGES_PER_CONV,
  IMAGE_TTL_MS, MAX_IMAGES_PER_USER,
  VOICE_TTL_MS, MAX_VOICES_PER_USER, MAX_VOICE_SECONDS,
  MAX_VOICE_SIZE_MB, MAX_VOICE_SIZE_BYTES,
  FILE_TTL_MS, RAM_THRESHOLD_MB, RAM_THRESHOLD_BYTES,
  MODEL_UPDATE_INTERVAL_MS, PISTON_URL,
};