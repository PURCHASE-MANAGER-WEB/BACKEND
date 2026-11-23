const mongoose = require('mongoose');
const crypto = require('crypto');

// Cross-portal bridge onto the Execution Portal's own "ep_notifications" collection, so this
// portal can drop an in-app alert straight into a specific Execution team member's bell when a
// material request's status / delivery stage changes. Lenient schema (strict:false) matching the
// Execution notification shape: { userId, type, title, message, link, read } + timestamps.
const ExecNotificationSchema = new mongoose.Schema(
  {
    _id: { type: String, default: () => crypto.randomUUID() },
    userId: { type: String, index: true },
    type: String,
    title: String,
    message: String,
    link: String,
    read: { type: Boolean, default: false },
  },
  { collection: 'ep_notifications', timestamps: true, strict: false }
);

module.exports = mongoose.models.ExecNotification || mongoose.model('ExecNotification', ExecNotificationSchema);
