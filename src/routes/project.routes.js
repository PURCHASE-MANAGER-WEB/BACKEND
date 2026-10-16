// Procurement project master APIs — purchase_projects collection.
const router = require('express').Router();
const Project = require('../models/Project');
const { protect, restrictTo } = require('../middleware/auth');

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
    for (let i = 0; i < 50; i++) {
      b.id = await nextId();
      try { return res.status(201).json(await Project.create(b)); }
      catch (e) { if (e && e.code === 11000) continue; throw e; }
    }
    throw new Error('Could not allocate a project id');
  } catch (err) { res.status(400).json({ message: err.message }); }
});

router.put('/:id', async (req, res) => {
  try {
    const body = { ...(req.body || {}) };
    delete body.id;
    const doc = await Project.findOneAndUpdate({ id: req.params.id }, { $set: body }, { new: true, runValidators: true });
    if (!doc) return res.status(404).json({ message: 'Project not found' });
    res.json(doc);
  } catch (err) { res.status(400).json({ message: err.message }); }
});

router.delete('/:id', async (req, res) => {
  try {
    const doc = await Project.findOne({ id: req.params.id });
    if (!doc) return res.status(404).json({ message: 'Project not found' });
    const PurchaseOrder = require('../models/PurchaseOrder');
    const used = await PurchaseOrder.countDocuments({ project: doc.name });
    if (used > 0) return res.status(409).json({ message: `This project has ${used} purchase-order line(s). Remove them before deleting the project.` });
    await Project.deleteOne({ id: req.params.id });
    res.json({ success: true });
  } catch (err) { res.status(400).json({ message: err.message }); }
});

module.exports = router;
