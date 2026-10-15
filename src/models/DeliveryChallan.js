const mongoose = require('mongoose');

// Delivery Challan (DC) — purchase_challans collection. One DC may list several
// material line items and links to a vendor, project and PO where applicable.
// The uploaded challan document is stored in-record as base64 (docData); list
// queries project it out so the table stays light. strict:false for future fields.
const ChallanSchema = new mongoose.Schema(
  {
    id: { type: String, required: true, unique: true }, // DC-001 (the DC number)
    date: String,                 // YYYY-MM-DD
    vid: String,                  // vendor id (VEN-xxx)
    project: String,              // project name
    po: String,                   // related PO number (optional)
    items: [{ material: String, qty: Number, unit: String }],
    status: { type: String, default: 'Received' }, // Pending / Partial / Received
    docName: String, docType: String, docSize: Number,
    docData: String,              // base64 bytes (excluded from list queries)
    notes: String,
  },
  { timestamps: true, strict: false, collection: 'purchase_challans' }
);

module.exports = mongoose.model('PurchaseChallan', ChallanSchema);
