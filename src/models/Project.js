const mongoose = require('mongoose');

// Procurement projects master — separate `purchase_projects` collection.
// Purchase orders link to a project by its NAME (PurchaseOrder.project), matching
// the existing data model; all money roll-ups (PO value, payments, outstanding) are
// derived on the client from the PO/payment records, so nothing is duplicated here.
const ProjectSchema = new mongoose.Schema(
  {
    id: { type: String, required: true, unique: true }, // PRJ-001
    name: { type: String, required: true },             // also the link key used by POs
    code: String,
    client: String,
    budget: { type: Number, default: 0 },               // allocated budget (₹)
    status: { type: String, default: 'Active' },        // Active / On Hold / Completed / Cancelled
    startDate: String,                                  // YYYY-MM-DD
    notes: String,
  },
  { timestamps: true, strict: false, collection: 'purchase_projects' }
);

module.exports = mongoose.model('PurchaseProject', ProjectSchema);
