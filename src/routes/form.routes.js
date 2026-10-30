// Proposal & Handover form APIs — purchase_forms (structured data) and
// purchase_form_files (uploaded completed forms + supporting documents, stored as
// bytes in our own MongoDB). Same auth as the order/invoice/file routes; the
// restricted Purchase Manager is allowed through (like PO attachments), so these
// routes do NOT use blockPurchaseManager.
const router = require('express').Router();
const ProjectForm = require('../models/ProjectForm');
const FormFile = require('../models/FormFile');
const { protect, restrictTo } = require('../middleware/auth');

const CAN = ['purchase_manager', 'Sales Head', 'accounts_manager'];
router.use(protect, restrictTo(...CAN));

const MAX = 12 * 1024 * 1024; // 12 MB — fits inside a single Mongo document

const ALLOWED_EXT = /\.(pdf|jpe?g|png|xls|xlsx|doc|docx)$/i;
const ALLOWED_TYPE = /(pdf|jpeg|jpg|png|vnd\.ms-excel|spreadsheetml|msword|wordprocessingml|octet-stream)/i;
const okType = (name, type) => ALLOWED_EXT.test(String(name || '')) || ALLOWED_TYPE.test(String(type || ''));

const prefixFor = (kind) => (String(kind) === 'proposal' ? 'FRM-PR-' : 'FRM-HO-');

// Allocate the next form id for a kind: FRM-PR-001 / FRM-HO-001.
const nextId = async (kind) => {
  const pfx = prefixFor(kind);
  const rows = await ProjectForm.find({ formId: new RegExp('^' + pfx + '\\d+$') }).select('formId').lean();
  const n = rows.map((r) => parseInt(String(r.formId).replace(/\D/g, ''), 10) || 0);
  return pfx + String((n.length ? Math.max(...n) : 0) + 1).padStart(3, '0');
};

// GET /api/forms?project=NAME&kind=proposal — list form records (no file bytes here).
router.get('/', async (req, res) => {
  try {
    const q = {};
    if (req.query.project) q.project = decodeURIComponent(req.query.project);
    if (req.query.projectId) q.projectId = decodeURIComponent(req.query.projectId);
    if (req.query.kind) q.kind = req.query.kind;
    const docs = await ProjectForm.find(q).sort({ kind: 1, createdAt: 1 }).lean();
    res.json(docs);
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// GET /api/forms/:id — one record (full structured data).
router.get('/:id', async (req, res) => {
  try {
    const doc = await ProjectForm.findOne({ formId: req.params.id }).lean();
    if (!doc) return res.status(404).json({ message: 'Form not found.' });
    res.json(doc);
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// POST /api/forms — create a new form record. Body: { kind, project, projectId, projectCode, ref, title, date, data }.
router.post('/', async (req, res) => {
  try {
    const b = { ...(req.body || {}) };
    delete b.formId;
    const kind = b.kind === 'proposal' ? 'proposal' : 'handover';
    b.kind = kind;
    for (let i = 0; i < 50; i++) {
      b.formId = await nextId(kind);
      try { const d = await ProjectForm.create(b); return res.status(201).json(d.toObject()); }
      catch (e) { if (e && e.code === 11000) continue; throw e; }
    }
    throw new Error('Could not allocate a form number.');
  } catch (err) { res.status(400).json({ message: err.message }); }
});

// PUT /api/forms/:id — update a form record's structured data.
router.put('/:id', async (req, res) => {
  try {
    const body = { ...(req.body || {}) };
    delete body.formId; delete body.kind; // identity is fixed
    const doc = await ProjectForm.findOneAndUpdate({ formId: req.params.id }, { $set: body }, { new: true, runValidators: true });
    if (!doc) return res.status(404).json({ message: 'Form not found.' });
    res.json(doc.toObject());
  } catch (err) { res.status(400).json({ message: err.message }); }
});

// DELETE /api/forms/:id — remove the form record and all its uploaded files.
router.delete('/:id', async (req, res) => {
  try {
    await ProjectForm.deleteOne({ formId: req.params.id });
    await FormFile.deleteMany({ formId: req.params.id });
    res.json({ ok: true });
  } catch (err) { res.status(400).json({ message: err.message }); }
});

// ── Uploaded files for a form (completed form + supporting documents) ──

// GET /api/forms/:id/files — list this form's files (metadata only).
router.get('/:id/files', async (req, res) => {
  try {
    const formId = req.params.id;
    const docs = await FormFile.find({ formId }).select('-data').sort({ createdAt: 1 }).lean();
    res.json(docs.map((d) => ({ fileId: d.fileId, category: d.category, name: d.name, type: d.type, size: d.size, formId: d.formId, uploadedAt: d.createdAt })));
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// POST /api/forms/:id/files — store ONE file. Body: { fileId, category, name, type, size, dataBase64 }.
router.post('/:id/files', async (req, res) => {
  try {
    const formId = req.params.id;
    const { fileId, category, name, type, size, dataBase64 } = req.body || {};
    if (!fileId) return res.status(400).json({ message: 'Missing file id.' });
    if (!okType(name, type)) return res.status(415).json({ message: 'Unsupported file type. Allowed: PDF, JPG, JPEG, PNG, Word, Excel.' });
    if (!dataBase64) return res.status(400).json({ message: 'No file data received.' });
    const raw = String(dataBase64);
    const b64 = raw.includes(',') ? raw.split(',').pop() : raw;
    const buf = Buffer.from(b64, 'base64');
    if (!buf.length) return res.status(400).json({ message: 'The file appears to be empty.' });
    if (buf.length > MAX) return res.status(413).json({ message: 'That file is larger than 12 MB.' });
    const doc = await FormFile.findOneAndUpdate(
      { formId, fileId },
      { $set: { category: category === 'completed' ? 'completed' : 'support', name: name || 'file', type: type || 'application/octet-stream', size: size || buf.length, data: buf } },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );
    res.json({ ok: true, fileId: doc.fileId, category: doc.category, name: doc.name, type: doc.type, size: doc.size, formId });
  } catch (err) { res.status(400).json({ message: err.message }); }
});

// GET /api/forms/:id/files/:fileId — stream one file. Inline by default; ?download=1 saves.
router.get('/:id/files/:fileId', async (req, res) => {
  try {
    const formId = req.params.id;
    const fileId = decodeURIComponent(req.params.fileId);
    const doc = await FormFile.findOne({ formId, fileId });
    if (!doc || !doc.data) return res.status(404).json({ message: 'File not found.' });
    const disp = req.query.download ? 'attachment' : 'inline';
    const safe = (doc.name || 'file').replace(/[^\w.\-]+/g, '_');
    res.set('Content-Type', doc.type || 'application/octet-stream');
    res.set('Content-Disposition', `${disp}; filename="${safe}"`);
    res.set('Cache-Control', 'private, max-age=60');
    res.send(doc.data);
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// DELETE /api/forms/:id/files/:fileId — remove one file.
router.delete('/:id/files/:fileId', async (req, res) => {
  try {
    await FormFile.deleteOne({ formId: req.params.id, fileId: decodeURIComponent(req.params.fileId) });
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

module.exports = router;
