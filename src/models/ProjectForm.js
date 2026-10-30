const mongoose = require('mongoose');

// Proposal & Handover forms for a project — stored in their own `purchase_forms`
// collection. One document is ONE form record; a project can have several of each
// kind (e.g. a revised proposal). The structured field values live in `data`
// (strict:false, so the exact sample fields can be stored without a rigid schema).
// Uploaded completed/signed forms and supporting documents are kept separately in
// `purchase_form_files` (see FormFile), keyed by this record's formId.
const ProjectFormSchema = new mongoose.Schema(
  {
    formId: { type: String, required: true, unique: true }, // FRM-PR-001 / FRM-HO-001
    kind: { type: String, required: true, index: true },    // 'proposal' | 'handover'
    project: { type: String, default: '', index: true },    // project name (link key)
    projectId: { type: String, default: '' },               // PRJ-001
    projectCode: { type: String, default: '' },             // project code
    ref: { type: String, default: '' },                     // reference / proposal ref no.
    title: { type: String, default: '' },                   // structure / subject summary
    date: { type: String, default: '' },                    // YYYY-MM-DD
    data: { type: mongoose.Schema.Types.Mixed, default: {} }, // all structured fields
  },
  { timestamps: true, strict: false, collection: 'purchase_forms' }
);

module.exports = mongoose.model('PurchaseForm', ProjectFormSchema);
