const mongoose = require('mongoose');

// A single purchase-order payment transaction. Lives in its own collection; a PO can have
// several. The PO's rolled-up "paid" (stored on its lines) is kept in sync from this ledger
// by the payment routes, so every existing view stays correct without duplicating data.
const PaymentSchema = new mongoose.Schema(
  {
    id: { type: String, required: true, unique: true }, // PMT-001
    po: { type: String, required: true },                // PO-001
    vid: String,                                         // vendor id (snapshot for convenience)
    amount: { type: Number, default: 0 },
    date: String,        // payment date  (YYYY-MM-DD)
    method: String,      // UPI / Cash / Cheque / Bank Transfer / ...
    refNo: String,       // transaction / reference number
    remarks: String,
    dueDate: String,     // payment due date (YYYY-MM-DD)
  },
  { timestamps: true, collection: 'purchase_payments' }
);

module.exports = mongoose.model('PurchasePayment', PaymentSchema);
