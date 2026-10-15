const mongoose = require('mongoose');

// Delivery Challan (DC) — purchase_challans collection. One DC lists several
// material line items (each with make + approx. weight for the printed challan)
// and links to a vendor, project and PO where applicable. Consignee / vehicle /
// driver / purpose feed the generated DC PDF. An optional uploaded challan
// document is stored in-record as base64 (docData); list queries project it out
// so the table stays light. strict:false for future fields.
const ChallanItemSchema = new mongoose.Schema(
  { material: String, qty: Number, unit: String, make: String, weight: Number, remarks: String },
  { _id: false }
);

const ChallanSchema = new mongoose.Schema(
  {
    id: { type: String, required: true, unique: true }, // DC-001 (the DC number)
    date: String,                 // YYYY-MM-DD
    vid: String,                  // vendor id (VEN-xxx)
    project: String,              // project name
    po: String,                   // related PO number (optional)
    items: [ChallanItemSchema],
    status: { type: String, default: 'Received' }, // Pending / Partial / Received
    // Challan document / dispatch details (for the printed DC)
    supplierRef: String,          // e.g. "Quotation No. 334"
    vehicleNo: String,
    driverName: String,
    driverMobile: String,
    consigneeName: String,
    consigneeAddress: String,
    consigneeMobile: String,
    purpose: String,              // Supply to Site / Job Work / Returnable / Non-Returnable
    docName: String, docType: String, docSize: Number,
    docData: String,              // base64 bytes (excluded from list queries)
    notes: String,
  },
  { timestamps: true, strict: false, collection: 'purchase_challans' }
);

module.exports = mongoose.model('PurchaseChallan', ChallanSchema);
