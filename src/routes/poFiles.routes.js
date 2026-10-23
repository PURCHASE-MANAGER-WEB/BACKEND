// Multiple PO attachments — stored in our own MongoDB (purchase_files), mirroring the
// single-invoice storage. Many files per PO. Same auth as the order/invoice routes.
const router = require('express').Router();
const PoFile = require('../models/PoFile');
const { protect, restrictTo } = require('../middleware/auth');

const CAN = ['purchase_manager', 'Sales Head', 'accounts_manager'];
router.use(protect, restrictTo(...CAN));

const MAX = 12 * 1024 * 1024; // 12 MB — fits inside a single Mongo document

// Allowed attachment types: PDF, JPG/JPEG, PNG, Excel (xls/xlsx).
const ALLOWED_EXT = /\.(pdf|jpe?g|png|xls|xlsx)$/i;
const ALLOWED_TYPE = /(pdf|jpeg|jpg|png|vnd\.ms-excel|spreadsheetml|octet-stream)/i;
const okType = (name, type) => ALLOWED_EXT.test(String(name || '')) || ALLOWED_TYPE.test(String(type || ''));

// GET /api/files/:po — list this PO's files (metadata only, no bytes).
router.get('/:po', async (req, res) => {
  try {
    const po = decodeURIComponent(req.params.po);
    const docs = await PoFile.find({ po }).select('-data').sort({ createdAt: 1 }).lean();
    res.json(docs.map((d) => ({ fileId: d.fileId, name: d.name, type: d.type, size: d.size, po: d.po, uploadedAt: d.createdAt })));
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// POST /api/files/:po — store ONE file. Body: { fileId, name, type, size, dataBase64 }.
router.post('/:po', async (req, res) => {
  try {
    const po = decodeURIComponent(req.params.po);
    const { fileId, name, type, size, dataBase64 } = req.body || {};
    if (!fileId) return res.status(400).json({ message: 'Missing file id.' });
    if (!okType(name, type)) return res.status(415).json({ message: 'Unsupported file type. Allowed: PDF, JPG, JPEG, PNG, Excel.' });
    if (!dataBase64) return res.status(400).json({ message: 'No file data received.' });
    const raw = String(dataBase64);
    const b64 = raw.includes(',') ? raw.split(',').pop() : raw;
    const buf = Buffer.from(b64, 'base64');
    if (!buf.length) return res.status(400).json({ message: 'The file appears to be empty.' });
    if (buf.length > MAX) return res.status(413).json({ message: 'That file is larger than 12 MB.' });
    const doc = await PoFile.findOneAndUpdate(
      { po, fileId },
      { $set: { name: name || 'file', type: type || 'application/octet-stream', size: size || buf.length, data: buf } },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );
    res.json({ ok: true, fileId: doc.fileId, name: doc.name, type: doc.type, size: doc.size, po });
  } catch (err) { res.status(400).json({ message: err.message }); }
});

// GET /api/files/:po/:fileId — stream one file's bytes. Inline by default; ?download=1 saves.
router.get('/:po/:fileId', async (req, res) => {
  try {
    const po = decodeURIComponent(req.params.po);
    const fileId = decodeURIComponent(req.params.fileId);
    const doc = await PoFile.findOne({ po, fileId });
    if (!doc || !doc.data) return res.status(404).json({ message: 'File not found.' });
    const disp = req.query.download ? 'attachment' : 'inline';
    const safe = (doc.name || 'file').replace(/[^\w.\-]+/g, '_');
    res.set('Content-Type', doc.type || 'application/octet-stream');
    res.set('Content-Disposition', `${disp}; filename="${safe}"`);
    res.set('Cache-Control', 'private, max-age=60');
    res.send(doc.data);
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// DELETE /api/files/:po/:fileId — remove one file.
router.delete('/:po/:fileId', async (req, res) => {
  try {
    await PoFile.deleteOne({ po: decodeURIComponent(req.params.po), fileId: decodeURIComponent(req.params.fileId) });
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

module.exports = router;
