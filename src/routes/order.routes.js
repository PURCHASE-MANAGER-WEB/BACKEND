// Purchase-order line APIs — purchase_orders collection.
const router = require('express').Router();
const PurchaseOrder = require('../models/PurchaseOrder');
const Payment = require('../models/Payment');
const { protect, restrictTo } = require('../middleware/auth');

const CAN = ['purchase_manager', 'Sales Head', 'accounts_manager'];
router.use(protect, restrictTo(...CAN));

router.get('/', async (req, res) => {
  try { res.json(await PurchaseOrder.find().sort({ po: 1 })); }
  catch (err) { res.status(500).json({ message: err.message }); }
});

router.post('/', async (req, res) => {
  try {
    const b = req.body || {};
    if (!b.id || !b.po) return res.status(400).json({ message: 'id and PO number are required' });
    res.status(201).json(await PurchaseOrder.create(b));
  } catch (err) {
    if (err && err.code === 11000) return res.status(409).json({ message: 'A line with this id already exists' });
    res.status(400).json({ message: err.message });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const l = await PurchaseOrder.findOneAndUpdate({ id: req.params.id }, { $set: req.body || {} }, { new: true, runValidators: true });
    if (!l) return res.status(404).json({ message: 'PO line not found' });
    res.json(l);
  } catch (err) { res.status(400).json({ message: err.message }); }
});

// Delete a WHOLE purchase order (all its lines). Blocked when money is recorded —
// any vendor payment against the PO, or any line already marked paid — so a PO tied
// to a completed transaction cannot be removed by accident.
router.delete('/po/:po', async (req, res) => {
  try {
    const po = req.params.po;
    const lines = await PurchaseOrder.find({ po });
    if (!lines.length) return res.status(404).json({ message: 'Purchase order not found' });
    const paidSum = lines.reduce((s, l) => s + (Number(l.paid) || 0), 0);
    const payCount = await Payment.countDocuments({ po });
    if (payCount > 0 || paidSum > 0) {
      return res.status(409).json({ message: 'This PO has recorded payments and cannot be deleted. Delete its payments first.' });
    }
    const r = await PurchaseOrder.deleteMany({ po });
    res.json({ success: true, deleted: r.deletedCount });
  } catch (err) { res.status(400).json({ message: err.message }); }
});

router.delete('/:id', async (req, res) => {
  try {
    const l = await PurchaseOrder.findOneAndDelete({ id: req.params.id });
    if (!l) return res.status(404).json({ message: 'PO line not found' });
    res.json({ success: true });
  } catch (err) { res.status(400).json({ message: err.message }); }
});

module.exports = router;
