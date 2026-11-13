const mongoose = require('mongoose');

// Permanent audit log: when a Project or Purchase Order was first created, and by whom.
// One entry per record (unique `key`) so edits/refreshes never duplicate it, and the
// entry survives even if the project/PO is later deleted (audit trail).
const CreationHistorySchema = new mongoose.Schema(
  {
    key: { type: String, required: true, unique: true }, // 'project:PRJ-001' | 'po:PO-001'
    recordType: { type: String, enum: ['Project', 'Purchase Order'], required: true },
    refId: String,          // project id or PO number
    name: String,           // project name or PO number
    createdByName: String,  // user who created it (captured once, never overwritten)
    createdByRole: String,
    at: { type: Date, default: Date.now }, // actual creation instant (server time)
  },
  { timestamps: true, collection: 'purchase_creation_history' }
);

module.exports = mongoose.model('PurchaseCreationHistory', CreationHistorySchema);
