// Delivery Challan APIs — purchase_challans collection.
const router = require('express').Router();
const Challan = require('../models/DeliveryChallan');
const { protect, restrictTo } = require('../middleware/auth');

const CAN = ['purchase_manager', 'Sales Head', 'accounts_manager'];
router.use(protect, restrictTo(...CAN));

const nextId = async () => {
  const rows = await Challan.find({ id: /^DC-\d+$/ }).select('id').lean();
  const n = rows.map((r) => parseInt(String(r.id).replace(/\D/g, ''), 10) || 0);
  return 'DC-' + String((n.length ? Math.max(...n) : 0) + 1).padStart(3, '0');
};

// List — without the heavy document bytes.
router.get('/', async (req, res) => {
  try { res.json(await Challan.find().select('-docData').sort({ date: -1, createdAt: -1 })); }
  catch (err) { res.status(500).json({ message: err.message }); }
});

// Fetch one DC's uploaded document (base64) for inline view / download.
router.get('/:id/doc', async (req, res) => {
  try {
    const doc = await Challan.findOne({ id: req.params.id }).select('docName docType docData');
    if (!doc || !doc.docData) return res.status(404).json({ message: 'No document for this challan' });
    res.json({ name: doc.docName, type: doc.docType, dataBase64: doc.docData });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

router.post('/', async (req, res) => {
  try {
    const b = { ...(req.body || {}) };
    delete b.id;
    for (let i = 0; i < 50; i++) {
      b.id = await nextId();
      try { const d = await Challan.create(b); const o = d.toObject(); delete o.docData; return res.status(201).json(o); }
      catch (e) { if (e && e.code === 11000) continue; throw e; }
    }
    throw new Error('Could not allocate a DC number');
  } catch (err) { res.status(400).json({ message: err.message }); }
});

router.put('/:id', async (req, res) => {
  try {
    const body = { ...(req.body || {}) };
    delete body.id;
    // Only overwrite the document when a new one is actually supplied.
    if (!('docData' in body)) { delete body.docData; delete body.docName; delete body.docType; delete body.docSize; }
    const doc = await Challan.findOneAndUpdate({ id: req.params.id }, { $set: body }, { new: true, runValidators: true }).select('-docData');
    if (!doc) return res.status(404).json({ message: 'Challan not found' });
    res.json(doc);
  } catch (err) { res.status(400).json({ message: err.message }); }
});

router.delete('/:id', async (req, res) => {
  try {
    const doc = await Challan.findOneAndDelete({ id: req.params.id });
    if (!doc) return res.status(404).json({ message: 'Challan not found' });
    res.json({ success: true });
  } catch (err) { res.status(400).json({ message: err.message }); }
});

module.exports = router;
