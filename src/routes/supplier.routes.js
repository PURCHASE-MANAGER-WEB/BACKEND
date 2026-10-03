// Supplier (vendor) APIs — purchase_suppliers collection.
const router = require('express').Router();
const Supplier = require('../models/Supplier');
const PurchaseOrder = require('../models/PurchaseOrder');
const { protect, restrictTo } = require('../middleware/auth');

const CAN = ['purchase_manager', 'Sales Head'];
router.use(protect, restrictTo(...CAN));

router.get('/', async (req, res) => {
  try { res.json(await Supplier.find().sort({ vid: 1 })); }
  catch (err) { res.status(500).json({ message: err.message }); }
});

router.post('/', async (req, res) => {
  try {
    const b = req.body || {};
    if (!b.vid || !b.name) return res.status(400).json({ message: 'Vendor ID and name are required' });
    res.status(201).json(await Supplier.create(b));
  } catch (err) {
    if (err && err.code === 11000) return res.status(409).json({ message: 'A supplier with this ID already exists' });
    res.status(400).json({ message: err.message });
  }
});

router.put('/:vid', async (req, res) => {
  try {
    const s = await Supplier.findOneAndUpdate({ vid: req.params.vid }, { $set: req.body || {} }, { new: true, runValidators: true });
    if (!s) return res.status(404).json({ message: 'Supplier not found' });
    res.json(s);
  } catch (err) { res.status(400).json({ message: err.message }); }
});

router.delete('/:vid', async (req, res) => {
  try {
    const used = await PurchaseOrder.countDocuments({ vid: req.params.vid });
    if (used > 0) return res.status(409).json({ message: `Supplier has ${used} PO line(s). Remove or reassign them first.` });
    const s = await Supplier.findOneAndDelete({ vid: req.params.vid });
    if (!s) return res.status(404).json({ message: 'Supplier not found' });
    res.json({ success: true });
  } catch (err) { res.status(400).json({ message: err.message }); }
});

module.exports = router;
