// Purchase payment ledger APIs — purchase_payments collection.
const router = require('express').Router();
const Payment = require('../models/Payment');
const PurchaseOrder = require('../models/PurchaseOrder');
const { protect, restrictTo } = require('../middleware/auth');

const CAN = ['purchase_manager', 'Sales Head'];
router.use(protect, restrictTo(...CAN));

const num = (v) => { const n = parseFloat(v); return isFinite(n) ? n : 0; };

// Keep a PO's rolled-up paid amount (stored on its lines) in sync with the payment ledger,
// so the dashboard, Purchase Progress and all cards stay correct. The whole paid total is
// placed on the PO's first line and the rest zeroed — every calculation uses the PO-level
// SUM of line.paid, so per-PO totals remain exact and nothing is duplicated.
async function syncPoPaid(po) {
  if (!po) return;
  const pays = await Payment.find({ po });
  const total = pays.reduce((s, p) => s + num(p.amount), 0);
  const lines = await PurchaseOrder.find({ po }).sort({ id: 1 });
  if (!lines.length) return;
  const ops = lines.map((l, i) => ({ updateOne: { filter: { id: l.id }, update: { $set: { paid: i === 0 ? total : 0 } } } }));
  await PurchaseOrder.bulkWrite(ops);
}

const nextId = async () => {
  const rows = await Payment.find({ id: /^PMT-\d+$/ }).select('id').lean();
  const n = rows.map((r) => parseInt(String(r.id).replace(/\D/g, ''), 10) || 0);
  return 'PMT-' + String((n.length ? Math.max(...n) : 0) + 1).padStart(3, '0');
};

router.get('/', async (req, res) => {
  try { res.json(await Payment.find().sort({ date: -1, createdAt: -1 })); }
  catch (err) { res.status(500).json({ message: err.message }); }
});

router.post('/', async (req, res) => {
  try {
    const b = { ...(req.body || {}) };
    if (!b.po) return res.status(400).json({ message: 'PO number is required' });
    delete b.id;
    for (let i = 0; i < 50; i++) {
      b.id = await nextId();
      try {
        const doc = await Payment.create(b);
        await syncPoPaid(b.po);
        return res.status(201).json(doc);
      } catch (e) { if (e && e.code === 11000) continue; throw e; }
    }
    throw new Error('Could not allocate a payment id');
  } catch (err) { res.status(400).json({ message: err.message }); }
});

router.put('/:id', async (req, res) => {
  try {
    const body = { ...(req.body || {}) };
    delete body.id;
    const doc = await Payment.findOneAndUpdate({ id: req.params.id }, { $set: body }, { new: true });
    if (!doc) return res.status(404).json({ message: 'Payment not found' });
    await syncPoPaid(doc.po);
    res.json(doc);
  } catch (err) { res.status(400).json({ message: err.message }); }
});

router.delete('/:id', async (req, res) => {
  try {
    const doc = await Payment.findOneAndDelete({ id: req.params.id });
    if (!doc) return res.status(404).json({ message: 'Payment not found' });
    await syncPoPaid(doc.po);
    res.json({ success: true });
  } catch (err) { res.status(400).json({ message: err.message }); }
});

module.exports = router;
