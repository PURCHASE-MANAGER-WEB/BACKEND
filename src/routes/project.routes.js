// Procurement project master APIs — purchase_projects collection.
const router = require('express').Router();
const Project = require('../models/Project');
const { protect, restrictTo } = require('../middleware/auth');
const ProjectHistory = require('../models/ProjectHistory');

// Fields tracked in the project change history (label shown to the user).
const HIST_FIELDS = { name: 'Name', code: 'Code', status: 'Status', client: 'Client', budget: 'Budget', creationDate: 'Creation Date', projectLocation: 'Project Location', contactDetails: 'Contact Details', mobileNumber: 'Mobile', altMobile: 'Alternate Mobile', emailWhatsapp: 'Email / WhatsApp', gstNumber: 'GST Number', billingName: 'Billing Name', siteAddress: 'Site Address', billingAddress: 'Billing Address', salespersonName: 'Salesperson', dateOfOrder: 'Date of Order', proposalRefNo: 'Proposal Ref', leadRef: 'Lead Ref', typeOfProject: 'Type of Project', projectSize: 'Project Size', materialDescription: 'Material Description', startDate: 'Start Date', tentativeCompletionDate: 'Completion Date', quotedPrice: 'Quoted Price', notes: 'Notes' };
const diffFields = (prev, body) => { const out = []; for (const k of Object.keys(HIST_FIELDS)) { if (!(k in body)) continue; const a = prev[k] == null ? '' : String(prev[k]); const b = body[k] == null ? '' : String(body[k]); if (a !== b) out.push({ field: HIST_FIELDS[k], from: a, to: b }); } return out; };
async function logProjectEvent({ projectId, action, req, changes, summary, at }) {
  try { await ProjectHistory.create({ projectId: String(projectId), action: action || 'updated', byName: (req && req.pm && req.pm.name) || (req && req.auth && req.auth.role) || 'User', byRole: (req && req.auth && req.auth.role) || '', changes: Array.isArray(changes) ? changes : [], summary: summary || '', at: at ? new Date(at) : new Date() }); } catch (e) { /* non-fatal */ }
}

const CAN = ['purchase_manager', 'Sales Head', 'accounts_manager'];
router.use(protect, restrictTo(...CAN));

// The restricted "Purchase Manager" designation must not receive the client-money
// fields (quoted value, payment-terms schedule). Purchase Head / Accounts get them.
const isRestrictedPM = (req) => req.pm && (req.pm.designation || 'Purchase Manager') === 'Purchase Manager';
const stripFinancial = (doc) => { const o = doc && doc.toObject ? doc.toObject() : { ...(doc || {}) }; delete o.quotedPrice; delete o.paymentTerms; return o; };

const nextId = async () => {
  const rows = await Project.find({ id: /^PRJ-\d+$/ }).select('id').lean();
  const n = rows.map((r) => parseInt(String(r.id).replace(/\D/g, ''), 10) || 0);
  return 'PRJ-' + String((n.length ? Math.max(...n) : 0) + 1).padStart(3, '0');
};

router.get('/', async (req, res) => {
  try { const docs = await Project.find().sort({ createdAt: -1 }); res.json(isRestrictedPM(req) ? docs.map(stripFinancial) : docs); }
  catch (err) { res.status(500).json({ message: err.message }); }
});

router.post('/', async (req, res) => {
  try {
    if (isRestrictedPM(req)) return res.status(403).json({ message: 'Purchase Managers are not allowed to create projects.' });
    const b = { ...(req.body || {}) };
    if (!String(b.name || '').trim()) return res.status(400).json({ message: 'Project name is required' });
    delete b.id;
    if (!b.creationDate) b.creationDate = new Date().toISOString().slice(0, 10);
    for (let i = 0; i < 50; i++) {
      b.id = await nextId();
      try {
        const doc = await Project.create(b);
        await logProjectEvent({ projectId: doc.id, action: 'created', req, summary: 'Project created', at: doc.createdAt });
        return res.status(201).json(doc);
      }
      catch (e) { if (e && e.code === 11000) continue; throw e; }
    }
    throw new Error('Could not allocate a project id');
  } catch (err) { res.status(400).json({ message: err.message }); }
});

router.put('/:id', async (req, res) => {
  try {
    const body = { ...(req.body || {}) };
    delete body.id;
    const prev = await Project.findOne({ id: req.params.id });
    if (!prev) return res.status(404).json({ message: 'Project not found' });
    const doc = await Project.findOneAndUpdate({ id: req.params.id }, { $set: body }, { new: true, runValidators: true });
    const changes = diffFields(prev.toObject ? prev.toObject() : prev, body);
    if (changes.length) await logProjectEvent({ projectId: doc.id, action: 'updated', req, changes });
    // Keep purchase orders linked when a project is renamed: move every PO on the old
    // name to the new name (both the primary `project` and the `projects[]` list).
    const oldName = String(prev.name || '').trim(), newName = String(doc.name || '').trim();
    if (oldName && newName && oldName !== newName) {
      const PurchaseOrder = require('../models/PurchaseOrder');
      await PurchaseOrder.updateMany({ project: oldName }, { $set: { project: newName } });
      await PurchaseOrder.updateMany({ projects: oldName }, { $set: { 'projects.$[el]': newName } }, { arrayFilters: [{ el: oldName }] });
    }
    res.json(doc);
  } catch (err) { res.status(400).json({ message: err.message }); }
});

router.delete('/:id', async (req, res) => {
  try {
    const doc = await Project.findOne({ id: req.params.id });
    if (!doc) return res.status(404).json({ message: 'Project not found' });
    const PurchaseOrder = require('../models/PurchaseOrder');
    const used = await PurchaseOrder.countDocuments({ $or: [{ project: doc.name }, { projects: doc.name }].concat(doc.code ? [{ project: doc.code }, { projects: doc.code }] : []) });
    if (used > 0) return res.status(409).json({ message: `This project has ${used} purchase-order line(s). Remove them before deleting the project.` });
    await Project.deleteOne({ id: req.params.id });
    res.json({ success: true });
  } catch (err) { res.status(400).json({ message: err.message }); }
});

router.get('/:id/history', async (req, res) => {
  try {
    const list = await ProjectHistory.find({ projectId: req.params.id }).sort({ at: -1, createdAt: -1 }).lean();
    // For projects created before change-logging existed, show their real DB creation
    // date as the first entry (never an invented date).
    if (!list.some((e) => e.action === 'created')) {
      const proj = await Project.findOne({ id: req.params.id }).select('createdAt creationDate').lean();
      if (proj) list.push({ action: 'created', byName: '', byRole: '', changes: [], summary: 'Project created', at: proj.creationDate || proj.createdAt });
    }
    res.json(list);
  } catch (err) { res.status(500).json({ message: err.message }); }
});

module.exports = router;
