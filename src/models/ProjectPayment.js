const mongoose = require('mongoose');

// Project payment schedule — milestone-based, matching the Sales Coordinator
// "Order Confirmation" form: a quoted/order value plus payment-term milestones,
// each a term, a percentage, the value (quoted × %/100) and a paid date/flag so
// it also works as a tracker. Linked to a project by name. strict:false keeps any
// legacy flat fields (p1..p5) readable.
const MilestoneSchema = new mongoose.Schema(
  { term: String, percentage: Number, value: Number, date: String, paid: Boolean },
  { _id: false }
);

const ProjectPaymentSchema = new mongoose.Schema(
  {
    id: { type: String, required: true, unique: true }, // PPM-001
    project: String,
    customerName: { type: String, required: true },
    quotedValue: { type: Number, default: 0 },          // base order/project value
    milestones: [MilestoneSchema],
    notes: String,
  },
  { timestamps: true, strict: false, collection: 'purchase_project_payments' }
);

module.exports = mongoose.model('PurchaseProjectPayment', ProjectPaymentSchema);
