const mongoose = require('mongoose');

// Procurement's view of a Design CRM request. It is the SAME `design_requests`
// collection the Design CRM reads/writes — the two systems share one database, so
// a request raised here appears in the Design CRM automatically, and the approval
// status / approved files the Design CRM writes back are read here. Lenient schema
// (strict:false) so the Design CRM's richer fields round-trip untouched.
const Att = new mongoose.Schema({ name: String, size: String, type: String, fileId: String }, { _id: false });
const Hist = new mongoose.Schema({ title: String, time: String, desc: String }, { _id: false });

const DesignRequestSchema = new mongoose.Schema(
  {
    id: { type: String, required: true, unique: true }, // REQ-2026-001
    source: { type: String, default: 'procurement' },
    status: { type: String, default: 'New' },

    // Procurement linkage
    procurementProjectId: { type: String, default: '' },
    procurementProjectCode: { type: String, default: '' },
    requestedByUser: { type: String, default: '' },

    // Core request details
    projectName: { type: String, default: '' },
    customerName: { type: String, default: '' },
    projectType: { type: String, default: 'PEB' },
    service: { type: String, default: '' },
    requirement: { type: String, default: '' },        // design requirements / deliverable
    description: { type: String, default: '' },
    priority: { type: String, default: 'Medium' },
    dueDate: { type: String, default: '' },
    assignedDesigner: { type: String, default: 'Unassigned' },

    attachments: { type: [Att], default: [] },
    history: { type: [Hist], default: [] },

    // Approval outcome (written by the Design CRM)
    approvedDate: { type: String, default: '' },
    approvedBy: { type: String, default: '' },
    approvedFiles: { type: [Att], default: [] },
    rejectionReason: { type: String, default: '' },
    changeRemarks: { type: String, default: '' },
  },
  { timestamps: true, strict: false, collection: 'design_requests' }
);

module.exports = mongoose.model('DesignRequestBridge', DesignRequestSchema);
