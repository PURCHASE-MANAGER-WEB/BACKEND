const mongoose = require('mongoose');

// Procurement projects master — separate `purchase_projects` collection.
// Purchase orders link to a project by its NAME (PurchaseOrder.project). Money
// roll-ups (PO value, payments, outstanding) are derived on the client from the
// PO/payment records. The project now also stores the full Sales→Project handover
// details, the budget planning sheet (budgetHeads) and the payment-terms schedule.
const BudgetHeadSchema = new mongoose.Schema(
  { head: String, performa: Number, approved: Number, poValue: Number, actual: Number, remarks: String },
  { _id: false }
);
const TermSchema = new mongoose.Schema(
  { term: String, percentage: Number, value: Number },
  { _id: false }
);

const ProjectSchema = new mongoose.Schema(
  {
    id: { type: String, required: true, unique: true }, // PRJ-001
    name: { type: String, required: true },             // also the link key used by POs
    code: String,
    client: String,
    budget: { type: Number, default: 0 },               // allocated budget (₹)
    status: { type: String, default: 'Active' },        // Active / On Hold / Completed / Cancelled
    startDate: String,                                  // YYYY-MM-DD (tentative start)
    materialDescription: String,
    budgetHeads: [BudgetHeadSchema],                    // project budget planning sheet
    notes: String,

    // ── Sales → Project handover: client & project details ──
    leadRef: String,
    projectLocation: String,
    contactDetails: String,
    billingName: String,
    mobileNumber: String,
    altMobile: String,
    siteAddress: String,
    billingAddress: String,
    gstNumber: String,
    emailWhatsapp: String,
    salespersonName: String,
    dateOfOrder: String,
    proposalRefNo: String,

    // ── Scope of work ──
    typeOfProject: String,
    projectSize: String,
    design3D: Boolean,
    design2D: Boolean,
    transportationScope: String, // Yes / No
    scaffoldingScope: String,    // Yes / No

    // ── Timeline ──
    tentativeCompletionDate: String,
    leadTimePromised: String,

    // ── Pricing & payment terms ──
    quotedPrice: Number,
    paymentTerms: [TermSchema],

    // ── Confirmations & declarations ──
    siteEngineerVisit: Boolean,
    salespersonDeclaration: Boolean,
  },
  { timestamps: true, strict: false, collection: 'purchase_projects' }
);

module.exports = mongoose.model('PurchaseProject', ProjectSchema);
