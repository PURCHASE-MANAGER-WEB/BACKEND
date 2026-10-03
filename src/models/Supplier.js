const mongoose = require('mongoose');

// Procurement vendors/suppliers — separate `purchase_suppliers` collection.
const SupplierSchema = new mongoose.Schema(
  {
    vid: { type: String, required: true, unique: true }, // VEN-001
    name: { type: String, required: true },
    contact: String,
    mobile: String,
    email: String,
    address: String,
    gst: String,
    material: String,
    creditLimit: { type: Number, default: 0 },
    terms: String,
    status: { type: String, default: 'Active' },
  },
  { timestamps: true, strict: false, collection: 'purchase_suppliers' }
);

module.exports = mongoose.model('Supplier', SupplierSchema);
