const mongoose = require('mongoose');

// Project payment schedule — one row per customer/project, mirroring the
// "Payment Pending Cases" sheet: payment terms (milestone split) + up to five
// installments, each an amount and a date. Linked to a project by name.
// `strict:false` so an extra installment (p6…) can be added later without a migration.
const ProjectPaymentSchema = new mongoose.Schema(
  {
    id: { type: String, required: true, unique: true }, // PPM-001
    project: String,          // linked project name (may be blank for an ad-hoc customer)
    customerName: { type: String, required: true },
    terms: String,            // e.g. "50%,40%,10%"
    p1: { type: Number, default: 0 }, p1Date: String,
    p2: { type: Number, default: 0 }, p2Date: String,
    p3: { type: Number, default: 0 }, p3Date: String,
    p4: { type: Number, default: 0 }, p4Date: String,
    p5: { type: Number, default: 0 }, p5Date: String,
    notes: String,
  },
  { timestamps: true, strict: false, collection: 'purchase_project_payments' }
);

module.exports = mongoose.model('PurchaseProjectPayment', ProjectPaymentSchema);
