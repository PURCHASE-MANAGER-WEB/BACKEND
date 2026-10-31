const mongoose = require('mongoose');

// Procurement's access to the Design CRM's file store (`design_files`). Same
// collection the Design CRM uploads to, so Procurement can attach supporting files
// to a request and download the approved design files the team uploaded.
const DesignFileSchema = new mongoose.Schema(
  {
    entity: { type: String, default: '' },     // 'request' | 'submittal' | …
    entityId: { type: String, default: '' },    // REQ-… id
    name: { type: String, default: 'file' },
    type: { type: String, default: 'application/octet-stream' },
    size: { type: Number, default: 0 },
    uploadedBy: { type: String, default: '' },
    data: Buffer,
  },
  { timestamps: true, collection: 'design_files' }
);

module.exports = mongoose.model('DesignFileBridge', DesignFileSchema);
