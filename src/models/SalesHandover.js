const mongoose = require('mongoose');

// Procurement's READ-ONLY view of a Sales handover. This is the SAME shared `ho_handovers`
// collection the Sales and Execution portals use — one record, no duplication, original
// handover id (HO-…) and _id preserved. Lenient schema (strict:false) so every field the Sales
// portal writes round-trips untouched. The _id is a shared UUID string.
const SalesHandoverSchema = new mongoose.Schema(
  { _id: { type: String } },
  { strict: false, collection: 'ho_handovers', timestamps: true }
);

module.exports = mongoose.models.SalesHandoverBridge || mongoose.model('SalesHandoverBridge', SalesHandoverSchema);
