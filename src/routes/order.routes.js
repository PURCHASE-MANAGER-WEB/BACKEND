// Purchase-order line APIs — purchase_orders collection.
const router = require('express').Router();
const PurchaseOrder = require('../models/PurchaseOrder');
const Payment = require('../models/Payment');
const { protect, restrictTo, blockPurchaseManager } = require('../middleware/auth');

const CAN = ['purchase_manager', 'Sales Head', 'accounts_manager'];
router.use(protect, restrictTo(...CAN));

// Relink every PO on one (old / misspelled) project name to another — a safe, explicit
// cleanup for orphaned POs. Non-PM only (project management is not a Purchase Manager action).
router.post('/relink', blockPurchaseManager, async (req, res) => {
  try {
    const from = String((req.body || {}).from || '').trim();
    const to = String((req.body || {}).to || '').trim();
    if (!from || !to) return res.status(400).json({ message: 'from and to project names are required' });
    if (from === to) return res.json({ ok: true, updated: 0 });
    const r = await PurchaseOrder.updateMany({ project: from }, { $set: { project: to } });
    await PurchaseOrder.updateMany({ projects: from }, { $set: { 'projects.$[el]': to } }, { arrayFilters: [{ el: from }] });
    res.json({ ok: true, updated: r.modifiedCount != null ? r.modifiedCount : (r.nModified || 0) });
  } catch (err) { res.status(400).json({ message: err.message }); }
});

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

// Bulk upsert + delete all lines of one PO in a SINGLE request/DB write (fast save).
router.put('/po/:po/bulk', async (req, res) => {
  try {
    const po = req.params.po;
    const { lines = [], deleteIds = [] } = req.body || {};
    if (!Array.isArray(lines)) return res.status(400).json({ message: 'lines must be an array' });
    const ops = [];
    for (const l of lines) {
      if (!l || !l.id) return res.status(400).json({ message: 'every line needs an id' });
      ops.push({ updateOne: { filter: { id: l.id }, update: { $set: { ...l, po } }, upsert: true } });
    }
    if (Array.isArray(deleteIds) && deleteIds.length) ops.push({ deleteMany: { filter: { id: { $in: deleteIds } } } });
    if (ops.length) await PurchaseOrder.bulkWrite(ops, { ordered: false });
    res.json(await PurchaseOrder.find({ po }).sort({ po: 1 }));
  } catch (err) {
    if (err && err.code === 11000) return res.status(409).json({ message: 'A line with this id already exists' });
    res.status(400).json({ message: err.message });
  }
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
