const mongoose = require('mongoose');

// Multiple attachments per Purchase Order — stored directly in our own MongoDB, exactly
// like the single invoice (purchase_invoices), so viewing/downloading never depends on any
// third-party storage. Each document is ONE file; a PO can have many. A single Mongo
// document is capped at 16 MB, so the upload route rejects files larger than ~12 MB.
const PoFileSchema = new mongoose.Schema(
  {
    po: { type: String, required: true, index: true }, // PO-001
    fileId: { type: String, required: true },          // client-generated unique id
    name: { type: String, default: 'file' },
    type: { type: String, default: 'application/octet-stream' },
    size: { type: Number, default: 0 },
    data: Buffer,                                        // raw bytes
  },
  { timestamps: true, collection: 'purchase_files' }
);

PoFileSchema.index({ po: 1, fileId: 1 }, { unique: true });

module.exports = mongoose.model('PurchaseFile', PoFileSchema);
