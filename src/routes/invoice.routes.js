// Invoice PDF storage — kept in our own MongoDB so viewing/downloading never depends on
// any third-party (e.g. Cloudinary) delivery permissions. All routes require a logged-in
// Purchase Manager / Sales Head, exactly like the order routes.
const router = require('express').Router();
const Invoice = require('../models/Invoice');
const { protect, restrictTo } = require('../middleware/auth');

const CAN = ['purchase_manager', 'Sales Head'];
router.use(protect, restrictTo(...CAN));

const MAX = 12 * 1024 * 1024; // 12 MB

// PUT /api/invoices/:po — store or replace the invoice PDF for a PO.
// Body: { name, type, size, dataBase64 }  (dataBase64 may be a bare base64 string or a data: URL)
router.put('/:po', async (req, res) => {
  try {
    const po = decodeURIComponent(req.params.po);
    const { name, type, size, dataBase64 } = req.body || {};
    if (!dataBase64) return res.status(400).json({ message: 'No file data received.' });
    const raw = String(dataBase64);
    const b64 = raw.includes(',') ? raw.split(',').pop() : raw;
    const buf = Buffer.from(b64, 'base64');
    if (!buf.length) return res.status(400).json({ message: 'The file appears to be empty.' });
    if (buf.length > MAX) return res.status(413).json({ message: 'That file is larger than 12 MB. Please upload a smaller PDF.' });
    const doc = await Invoice.findOneAndUpdate(
      { po },
      { $set: { name: name || 'invoice.pdf', type: type || 'application/pdf', size: size || buf.length, data: buf } },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );
    res.json({ ok: true, po, name: doc.name, type: doc.type, size: doc.size });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// GET /api/invoices - list all invoices metadata (without file bytes)
router.get('/', async (req, res) => {
  try {
    const docs = await Invoice.find({}).select('-data').lean();
    res.json(docs);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// PUT /api/invoices/:po/details - update invoice structured data for Accounts
router.put('/:po/details', async (req, res) => {
  try {
    const po = decodeURIComponent(req.params.po);
    const updates = req.body || {};
    const doc = await Invoice.findOneAndUpdate(
      { po },
      { $set: updates },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    ).select('-data');
    res.json(doc);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// GET /api/invoices/:po/meta — lightweight existence/metadata check (no bytes).
router.get('/:po/meta', async (req, res) => {
  try {
    const po = decodeURIComponent(req.params.po);
    const doc = await Invoice.findOne({ po }).select('name type size updatedAt').lean();
    if (!doc) return res.status(404).json({ exists: false });
    res.json({ exists: true, name: doc.name, type: doc.type, size: doc.size, updatedAt: doc.updatedAt });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET /api/invoices/:po — stream the PDF bytes. Inline by default; ?download=1 forces a save.
router.get('/:po', async (req, res) => {
  try {
    const po = decodeURIComponent(req.params.po);
    const doc = await Invoice.findOne({ po });
    if (!doc || !doc.data) return res.status(404).json({ message: 'Invoice not found.' });
    const disp = req.query.download ? 'attachment' : 'inline';
    const safe = (doc.name || 'invoice.pdf').replace(/[^\w.\-]+/g, '_');
    res.set('Content-Type', doc.type || 'application/pdf');
    res.set('Content-Disposition', `${disp}; filename="${safe}"`);
    res.set('Cache-Control', 'private, max-age=60');
    res.send(doc.data);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// DELETE /api/invoices/:po — remove the stored invoice.
router.delete('/:po', async (req, res) => {
  try {
    await Invoice.deleteOne({ po: decodeURIComponent(req.params.po) });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
