const mongoose = require('mongoose');

// Writes into the SHARED `design_notifications` collection that the Design CRM reads.
// Used to alert the Design Head when Procurement raises a new design request.
// strict:false and the field set here mirror the Design CRM's own Notification model
// so the Design Head bell renders these exactly like its internal notifications.
const DesignNotificationSchema = new mongoose.Schema(
  {
    audience: { type: String, default: 'head' },       // 'head' | 'team' | 'procurement'
    title: { type: String, default: '' },
    message: { type: String, default: '' },
    desc: { type: String, default: '' },
    category: { type: String, default: '' },
    type: { type: String, default: '' },
    read: { type: Boolean, default: false },
    time: { type: String, default: '' },
    designerName: { type: String, default: '' },
    requestId: { type: String, default: '' },
    projectName: { type: String, default: '' },
    projectCode: { type: String, default: '' },
  },
  { timestamps: true, strict: false, collection: 'design_notifications' }
);

module.exports =
  mongoose.models.DesignNotificationBridge ||
  mongoose.model('DesignNotificationBridge', DesignNotificationSchema);
