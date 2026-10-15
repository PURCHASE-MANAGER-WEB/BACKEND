// Project payment schedule APIs — purchase_project_payments collection.
const router = require('express').Router();
const ProjectPayment = require('../models/ProjectPayment');
const { protect, restrictTo } = require('../middleware/auth');

const CAN = ['purchase_manager', 'Sales Head', 'accounts_manager'];
router.use(protect, restrictTo(...CAN));

const nextId = async () => {
  const rows = await ProjectPayment.find({ id: /^PPM-\d+$/ }).select('id').lean();
  const n = rows.map((r) => parseInt(String(r.id).replace(/\D/g, ''), 10) || 0);
  return 'PPM-' + String((n.length ? Math.max(...n) : 0) + 1).padStart(3, '0');
};

router.get('/', async (req, res) => {
  try { res.json(await ProjectPayment.find().sort({ createdAt: -1 })); }
  catch (err) { res.status(500).json({ message: err.message }); }
});

router.post('/', async (req, res) => {
  try {
    const b = { ...(req.body || {}) };
    if (!String(b.customerName || '').trim()) return res.status(400).json({ message: 'Customer name is required' });
    delete b.id;
    for (let i = 0; i < 50; i++) {
      b.id = await nextId();
      try { return res.status(201).json(await ProjectPayment.create(b)); }
      catch (e) { if (e && e.code === 11000) continue; throw e; }
    }
    throw new Error('Could not allocate a payment-schedule id');
  } catch (err) { res.status(400).json({ message: err.message }); }
});

router.put('/:id', async (req, res) => {
  try {
    const body = { ...(req.body || {}) };
    delete body.id;
    const doc = await ProjectPayment.findOneAndUpdate({ id: req.params.id }, { $set: body }, { new: true, runValidators: true });
    if (!doc) return res.status(404).json({ message: 'Payment schedule not found' });
    res.json(doc);
  } catch (err) { res.status(400).json({ message: err.message }); }
});

router.delete('/:id', async (req, res) => {
  try {
    const doc = await ProjectPayment.findOneAndDelete({ id: req.params.id });
    if (!doc) return res.status(404).json({ message: 'Payment schedule not found' });
    res.json({ success: true });
  } catch (err) { res.status(400).json({ message: err.message }); }
});

module.exports = router;
