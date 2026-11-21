const mongoose = require('mongoose');

// Procurement's view of the shared handover notifications (`ho_notifications`). The Sales Portal
// writes an audience:'procurement' notification when a handover is submitted; this bridge reads
// and marks them. Lenient (strict:false); _id is a shared UUID string.
const SalesHandoverNotifSchema = new mongoose.Schema(
  { _id: { type: String } },
  { strict: false, collection: 'ho_notifications', timestamps: true }
);

module.exports = mongoose.models.SalesHandoverNotifBridge || mongoose.model('SalesHandoverNotifBridge', SalesHandoverNotifSchema);
