/* ═══════════════════════════════════════════════════════════════
   🥷 GUEST SERVICE (GU1–GU5)
   ═══════════════════════════════════════════════════════════════ */

const GuestSession = require('../models/guestSession.model');
const Conversation = require('../models/conversation.model');
const Message = require('../models/message.model');
const Context = require('../models/context.model');
const Project = require('../models/project.model');
const BrainKey = require('../models/brainKey.model');
const Share = require('../models/share.model');
const { generateToken } = require('../utils/helpers');
const logger = require('../utils/logger');

async function createGuestSession() {
  const sessionToken = generateToken(24);
  return GuestSession.create({ sessionToken, isConverted: false });
}

async function findGuestSession(sessionToken) {
  if (!sessionToken) return null;
  return GuestSession.findOne({ sessionToken }).lean();
}

async function convertGuestToAccount(sessionToken, userId) {
  const session = await GuestSession.findOne({ sessionToken });
  if (!session) throw new Error('Không tìm thấy session khách');
  if (session.isConverted) throw new Error('Session đã được chuyển thành account');

  const guestSessionId = session._id;

  const [r1, r2, r3, r4, r5, r6] = await Promise.all([
    Conversation.updateMany({ guestSessionId }, { $set: { userId, guestSessionId: null } }),
    Message.updateMany({ guestSessionId }, { $set: { userId, guestSessionId: null } }),
    Context.updateMany({ guestSessionId }, { $set: { userId, guestSessionId: null } }),
    Project.updateMany({ guestSessionId }, { $set: { userId, guestSessionId: null } }),
    BrainKey.updateMany({ guestSessionId }, { $set: { userId, guestSessionId: null } }),
    Share.updateMany({ guestSessionId }, { $set: { userId, guestSessionId: null } }),
  ]);

  session.isConverted = true;
  session.convertedToUserId = userId;
  await session.save();

  logger.success(`Guest → Account: ${sessionToken.slice(0, 8)}... → ${userId}`);

  return {
    migrated: {
      conversations: r1.modifiedCount,
      messages: r2.modifiedCount,
      contexts: r3.modifiedCount,
      projects: r4.modifiedCount,
      brainKeys: r5.modifiedCount,
      shares: r6.modifiedCount,
    },
  };
}

module.exports = { createGuestSession, findGuestSession, convertGuestToAccount };