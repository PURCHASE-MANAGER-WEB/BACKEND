const mongoose = require('mongoose');

// Purchase-order material lines — separate `purchase_orders` collection.
// A PO with several materials has several lines sharing one `po` number.
// Totals / pending / outstanding / status are derived on the client from these.
const PurchaseOrderSchema = new mongoose.Schema(
  {
    id: { type: String, required: true, unique: true }, // client-generated line id
    po: { type: String, required: true },   // PO-001
    poDate: String,
    vid: { type: String, required: true },  // supplier id (VEN-xxx)
    project: String,
    material: String,
    spec: String,
    qty: { type: Number, default: 0 },
    unit: String,
    rate: { type: Number, default: 0 },
    received: { type: Number, default: 0 },
    expDate: String,
    dueDate: String,
    paid: { type: Number, default: 0 },
  },
  { timestamps: true, strict: false, collection: 'purchase_orders' }
);

module.exports = mongoose.model('PurchaseOrder', PurchaseOrderSchema);
