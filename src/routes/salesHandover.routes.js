// Sales Handovers (read-only) for the Procurement Portal. Reads the SAME shared `ho_handovers`
// records that Sales submits and Execution accepts — for reference and purchase planning. Does
// not create, edit or duplicate any handover/project; it only reads and streams attachments, and
// reads/marks the Procurement notifications. Attachments come from the shared "ho_files" GridFS
// bucket. Role-guarded like the other procurement routes.
const router = require('express').Router();
const mongoose = require('mongoose');
const SalesHandover = require('../models/SalesHandover');
const SalesHandoverNotification = require('../models/SalesHandoverNotification');
const { protect, restrictTo } = require('../middleware/auth');

const CAN = ['purchase_manager', 'Sales Head', 'accounts_manager'];
router.use(protect, restrictTo(...CAN));

// Shared GridFS bucket that holds handover attachments (same bucket the Sales portal writes to).
let bucket;
const hoBucket = () => (bucket || (bucket = new mongoose.mongo.GridFSBucket(mongoose.connection.db, { bucketName: 'ho_files' })));

// Compact list row.
const summary = (h) => ({
  id: h._id,
  ref: h.ref || null,
  status: h.status || '',
  clientName: h.clientName || (h.details && h.details.clientName) || '',
  projectName: h.projectName || (h.scope && h.scope.typeOfProject) || (h.details && h.details.projectLocation) || '',
  projectType: (h.scope && h.scope.typeOfProject) || '',
  projectValue: h.projectValue || (h.pricing && h.pricing.quotedPrice) || 0,
  proposalRefNo: (h.details && h.details.proposalRefNo) || '',
  submittedAt: h.submittedAt || null,
  createdAt: h.createdAt,
  updatedAt: h.updatedAt,
  createdBy: h.createdBy || null,
  attachmentCount: (h.attachments || []).length,
});

// GET /api/sales-handovers — submitted handovers only (those with a ref), newest first.
router.get('/', async (req, res) => {
  try {
    const q = String(req.query.q || '').trim().toLowerCase();
    const list = await SalesHandover.find({ ref: { $ne: null } }).sort({ submittedAt: -1, updatedAt: -1 }).lean();
    let rows = list.map(summary);
    if (q) rows = rows.filter((h) => [h.ref, h.clientName, h.projectName, h.projectType, h.proposalRefNo, h.createdBy && h.createdBy.name]
      .filter(Boolean).join(' ').toLowerCase().includes(q));
    res.json({ handovers: rows });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// GET /api/sales-handovers/notifications — Procurement's handover alerts + unread count.
router.get('/notifications', async (req, res) => {
  try {
    const items = await SalesHandoverNotification.find({ audience: 'procurement' }).sort({ createdAt: -1 }).limit(30).lean();
    const unread = await SalesHandoverNotification.countDocuments({ audience: 'procurement', read: { $ne: true } });
    res.json({ items: items.map((n) => ({ id: n._id, title: n.title, message: n.message, ref: n.ref, handoverId: n.handoverId, read: !!n.read, createdAt: n.createdAt })), unread });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// GET /api/sales-handovers/new-count — unread count (sidebar badge).
router.get('/new-count', async (req, res) => {
  try { res.json({ count: await SalesHandoverNotification.countDocuments({ audience: 'procurement', read: { $ne: true } }) }); }
  catch (err) { res.status(500).json({ message: err.message }); }
});

// POST /api/sales-handovers/notifications/read-all — clear the unread flag.
router.post('/notifications/read-all', async (req, res) => {
  try { await SalesHandoverNotification.updateMany({ audience: 'procurement', read: { $ne: true } }, { $set: { read: true } }); res.json({ ok: true }); }
  catch (err) { res.status(500).json({ message: err.message }); }
});

// GET /api/sales-handovers/:id — full handover detail.
router.get('/:id', async (req, res) => {
  try {
    const h = await SalesHandover.findById(req.params.id).lean();
    if (!h) return res.status(404).json({ message: 'Handover not found' });
    res.json({ handover: { ...h, id: h._id } });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// GET /api/sales-handovers/:id/attachments/:fileId — view/download an attachment from GridFS.
router.get('/:id/attachments/:fileId', async (req, res) => {
  try {
    const h = await SalesHandover.findById(req.params.id).lean();
    if (!h) return res.status(404).json({ message: 'Handover not found' });
    const att = (h.attachments || []).find((a) => a.fileId === req.params.fileId);
    if (!att) return res.status(404).json({ message: 'Attachment not found' });
    res.set('Content-Type', att.mime || 'application/octet-stream');
    res.set('Content-Disposition', `${req.query.download ? 'attachment' : 'inline'}; filename="${encodeURIComponent(att.filename || 'file')}"`);
    let oid;
    try { oid = new mongoose.Types.ObjectId(att.fileId); } catch { return res.status(404).json({ message: 'Invalid file id' }); }
    hoBucket().openDownloadStream(oid).on('error', () => { if (!res.headersSent) res.status(404).end(); else res.end(); }).pipe(res);
  } catch (err) { res.status(500).json({ message: err.message }); }
});

module.exports = router;
