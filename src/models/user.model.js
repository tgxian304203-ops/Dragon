/* ═══════════════════════════════════════════════════════════════
   👤 USER — Kho 1 (tối đa 50 user)
   - [MỚI] Profile: preferredLang, techStack, commonProjects...
   ═══════════════════════════════════════════════════════════════ */

const mongoose = require('mongoose');

const userSchema = new mongoose.Schema(
  {
    username: {
      type: String, required: true, unique: true, trim: true,
      minlength: 3, maxlength: 32, index: true,
    },
    passwordHash: { type: String, required: true },
    displayName: { type: String, trim: true, maxlength: 64, default: '' },

    /* ═══ [MỚI] User Profile — dùng cho Rồng Thần hiểu user hơn ═══ */
    profile: {
      preferredLang: {
        type: String,
        enum: ['html', 'python', 'javascript', 'java', 'cpp', 'go', 'rust', 'react-native', 'flutter', ''],
        default: '',
        index: true,
      },
      techStack: { type: [String], default: [] },       // VD ["html", "css", "js"]
      commonProjects: { type: [String], default: [] },  // VD ["web", "shop", "api", "tool"]
      skillLevel: {
        type: String,
        enum: ['beginner', 'intermediate', 'advanced', ''],
        default: '',
      },
      preferredEditor: {
        type: String,
        enum: ['spck', 'vscode', 'pycharm', 'intellij', 'sublime', 'notepad', ''],
        default: '',
      },
      timezone: { type: String, default: 'Asia/Ho_Chi_Minh' },
      lastActiveAt: { type: Date, default: Date.now, index: true },
    },
  },
  { timestamps: true, collection: 'users' }
);

userSchema.index({ createdAt: 1 });
userSchema.index({ 'profile.preferredLang': 1 });
userSchema.index({ 'profile.lastActiveAt': -1 });

userSchema.set('toJSON', {
  transform: (doc, ret) => { delete ret.passwordHash; return ret; },
});

module.exports = mongoose.model('User', userSchema);