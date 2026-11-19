const mongoose = require('mongoose');

// Material requirements raised by the Execution Portal — the SHARED, un-prefixed
// "material_requests" collection (same MongoDB database). The Execution backend creates
// these docs (string UUID _id); this backend reads them and drives the procurement status
// (Requested → Ordered → Delivered / Rejected) and can convert one into a Purchase Order.
// Keep in step with the Execution model (Backend/src/material-request-model.js).
const MaterialRequestSchema = new mongoose.Schema(
  {
    _id: { type: String },                       // UUID set by the Execution backend
    ref: String,                                 // MR-2026-001
    projectId: String,
    projectName: String,
    handoverRef: String,
    material: String,
    spec: String,
    qty: { type: Number, default: 0 },
    unit: String,
    neededBy: String,
    notes: String,
    status: { type: String, default: 'Pending Approval' }, // Pending Approval | Approved | PO Created | Rejected
    rejectReason: { type: String, default: '' },
    poRef: { type: String, default: '' },
    createdBy: { id: String, name: String, role: String, portal: String },
    decidedBy: { id: String, name: String, role: String, portal: String }, // Purchase Manager who acted
    decidedAt: Date,
    statusLog: [{ _id: false, to: String, by: String, portal: String, at: Date, note: String }],
    procurementSeen: { type: Boolean, default: false },
    requesterSeen: { type: Boolean, default: true },
  },
  { collection: 'material_requests', timestamps: true, strict: false }
);

module.exports = mongoose.model('MaterialRequest', MaterialRequestSchema);
