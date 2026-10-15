const mongoose = require('mongoose');

// Client payment record — money RECEIVED from the client for a project/order.
// Mirrors the "Payment Pending Cases" sheet column-for-column AND doubles as the
// client-side ledger behind Payment Progress → Client Payment: an order value,
// payment terms and an unlimited list of receipts (each with amount, date, method,
// reference and remarks) so partial / multiple collections are fully supported.
// Kept completely separate from vendor payments (purchase_payments). Linked to a
// project by name. strict:false keeps any legacy milestone fields readable.
const PaymentLineSchema = new mongoose.Schema(
  {
    amount: Number,
    date: String,
    method: String,
    refNo: String,
    remarks: String,
    dueDate: String,
  },
  { _id: false }
);

const ProjectPaymentSchema = new mongoose.Schema(
  {
    id: { type: String, required: true, unique: true }, // PPM-001
    project: String,
    customerName: { type: String, required: true },
    clientName: String, // client / customer the money is received from
    condition: { type: String, default: 'Payment Pending' }, // Payment Pending | Ongoing | Completed
    totalOrderValue: { type: Number, default: 0 },
    collectionSoFar: { type: Number, default: 0 }, // kept in sync with the sum of receipts
    budget: { type: Number, default: 0 },
    afterBudgetOutstanding: { type: Number, default: 0 }, // after budget final outstanding
    collectionAmount: { type: Number, default: 0 },
    collectionDate: String,
    collectionMethod: String, // UPI / Cash / Cheque / Bank Transfer / Card / Other
    dueDate: String, // expected payment due date (drives overdue)
    update: String, // latest update / remark
    paymentTerms: String,
    payments: [PaymentLineSchema], // client receipts (partial / multiple collections)
    notes: String,
  },
  { timestamps: true, strict: false, collection: 'purchase_project_payments' }
);

module.exports = mongoose.model('PurchaseProjectPayment', ProjectPaymentSchema);
