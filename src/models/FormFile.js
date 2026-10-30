const mongoose = require('mongoose');

// Uploaded files attached to a Proposal/Handover form record — stored directly in
// our own MongoDB (purchase_form_files), exactly like PO attachments. Each document
// is ONE file; a form can have many. `category` separates the signed/completed form
// ('completed') from supporting documents ('support'). A single Mongo document is
// capped at 16 MB, so the upload route rejects files larger than ~12 MB.
const FormFileSchema = new mongoose.Schema(
  {
    formId: { type: String, required: true, index: true }, // FRM-PR-001 / FRM-HO-001
    fileId: { type: String, required: true },              // client-generated unique id
    category: { type: String, default: 'support' },        // 'completed' | 'support'
    name: { type: String, default: 'file' },
    type: { type: String, default: 'application/octet-stream' },
    size: { type: Number, default: 0 },
    data: Buffer,                                           // raw bytes
  },
  { timestamps: true, collection: 'purchase_form_files' }
);

FormFileSchema.index({ formId: 1, fileId: 1 }, { unique: true });

module.exports = mongoose.model('PurchaseFormFile', FormFileSchema);
