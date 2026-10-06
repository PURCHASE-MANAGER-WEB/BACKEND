const mongoose = require('mongoose');

// Invoice PDF stored directly in our own MongoDB (NOT Cloudinary), one document per PO.
// The bytes live in `data` (BSON binary); a single Mongo document is capped at 16 MB, so
// the upload route rejects files larger than ~12 MB to stay comfortably under that limit.
const InvoiceSchema = new mongoose.Schema(
  {
    po: { type: String, required: true, unique: true }, // one invoice per PO (PO-001)
    name: { type: String, default: 'invoice.pdf' },
    type: { type: String, default: 'application/pdf' },
    size: { type: Number, default: 0 },
    data: Buffer, // raw PDF bytes
  },
  { timestamps: true, collection: 'purchase_invoices' }
);

module.exports = mongoose.model('PurchaseInvoice', InvoiceSchema);
