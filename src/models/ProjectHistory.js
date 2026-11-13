const mongoose = require('mongoose');

// Change log for a project: one entry per create/edit, with who, when, and what changed.
// Separate `purchase_project_history` collection so it survives even if the project is
// later deleted, and never bloats the project document.
const ChangeSchema = new mongoose.Schema({ field: String, from: String, to: String }, { _id: false });

const ProjectHistorySchema = new mongoose.Schema(
  {
    projectId: { type: String, required: true, index: true }, // PRJ-001
    action: String,        // 'created' | 'updated'
    byName: String,        // user who made the change
    byRole: String,
    summary: String,
    changes: [ChangeSchema],
    at: { type: Date, default: Date.now }, // server time of the change
  },
  { timestamps: true, collection: 'purchase_project_history' }
);

module.exports = mongoose.model('PurchaseProjectHistory', ProjectHistorySchema);
