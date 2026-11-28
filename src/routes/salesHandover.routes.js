// Sales Handovers (read-only) for the Procurement Portal. Reads the SAME shared `ho_handovers`
// records that Sales submits and Execution accepts — for reference and purchase planning. Does
// not create, edit or duplicate any handover/project; it only reads and streams attachments, and
// reads/marks the Procurement notifications. Attachments come from the shared "ho_files" GridFS
// bucket. Role-guarded like the other procurement routes.
const router = require('express').Router();
const mongoose = require('mongoose');
const SalesHandover = require('../models/SalesHandover');
const SalesHandoverNotification = require('../models/SalesHandoverNotification');
const Project = require('../models/Project');
const { ensureClientOrder } = require('./project.routes');   // links the new project into Payment Progress
const { protect, restrictTo, blockPurchaseManager } = require('../middleware/auth');

const CAN = ['purchase_manager', 'Sales Head', 'accounts_manager'];
router.use(protect, restrictTo(...CAN));

// ── Procurement acceptance helpers ──────────────────────────────────────────
// Who performed the action (for the date-wise status history).
const actorOf = (req) => ({
  id: (req.pm && req.pm._id) || (req.auth && req.auth.id) || '',
  name: (req.pm && req.pm.name) || (req.auth && req.auth.role) || 'Procurement',
  role: (req.auth && req.auth.role) || '',
});
const escRx = (v) => String(v || '').trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const nextProjectId = async () => {
  const rows = await Project.find({ id: /^PRJ-\d+$/ }).select('id').lean();
  const n = rows.map((r) => parseInt(String(r.id).replace(/\D/g, ''), 10) || 0);
  return 'PRJ-' + String((n.length ? Math.max(...n) : 0) + 1).padStart(3, '0');
};

// Build a Procurement project (purchase_projects) from a Sales handover — no re-keying of data.
function mapHandoverToProject(h) {
  const det = h.details || {}, sc = h.scope || {}, tl = h.timeline || {}, pr = h.pricing || {};
  const name = String(h.projectName || sc.typeOfProject || det.clientName || det.billingName || h.clientName || ('Handover ' + (h.ref || ''))).trim() || ('Handover ' + (h.ref || h._id));
  return {
    name,
    client: det.clientName || h.clientName || '',
    quotedPrice: Number(pr.quotedPrice || h.projectValue || 0) || 0,
    status: 'Active',
    handoverId: String(h._id),
    handoverRef: h.ref || '',
    leadRef: det.leadId || h.ref || '',
    proposalRefNo: det.proposalRefNo || '',
    projectLocation: det.projectLocation || '',
    contactDetails: det.mobileNumber || '',
    billingName: det.billingName || '',
    mobileNumber: det.mobileNumber || '',
    altMobile: det.alternateMobile || '',
    emailWhatsapp: det.emailWhatsapp || '',
    gstNumber: det.gstNumber || '',
    siteAddress: det.siteAddress || '',
    billingAddress: det.billingAddress || '',
    salespersonName: det.salespersonName || (h.createdBy && h.createdBy.name) || '',
    dateOfOrder: det.dateOfOrder || '',
    typeOfProject: sc.typeOfProject || '',
    projectSize: sc.projectSizeArea || '',
    tentativeCompletionDate: tl.tentativeCompletionDate || '',
    leadTimePromised: tl.leadTimePromised || '',
    notes: `Created from Sales Handover ${h.ref || h._id}`,
  };
}

// Record a notification (same shared ho_notifications collection the bridge already reads).
async function notifyHandover(audience, h, title, message) {
  try {
    await SalesHandoverNotification.create({
      _id: 'SHN-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7),
      audience, handoverId: String(h._id), ref: h.ref || '', title, message, read: false,
    });
  } catch (e) { /* non-fatal */ }
}

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
  // Procurement-side review state (separate from the Sales/Execution status above).
  procStatus: h.procStatus || 'pending',          // pending | accepted | rejected
  procProjectId: h.procProjectId || '',
  procRejectReason: h.procRejectReason || '',
  procReviewedBy: h.procReviewedBy || null,
  procReviewedAt: h.procReviewedAt || null,
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

// POST /api/sales-handovers/:id/accept — Procurement accepts a handover. Creates the project
// in purchase_projects from the handover data (no re-entry), links it to Payment Progress,
// records the status history and notifies Sales. Idempotent: never creates a duplicate project.
router.post('/:id/accept', blockPurchaseManager, async (req, res) => {
  try {
    const h = await SalesHandover.findById(req.params.id).lean();
    if (!h) return res.status(404).json({ message: 'Handover not found' });

    // Already accepted → return the existing project (no duplicate).
    if (h.procProjectId) {
      const existing = await Project.findOne({ id: h.procProjectId });
      if (existing) return res.json({ ok: true, alreadyAccepted: true, projectId: existing.id, project: existing });
    }

    const mapped = mapHandoverToProject(h);
    // Dedup: link to a project already created from this handover, or one with the same name.
    let project = await Project.findOne({ $or: [{ handoverId: String(h._id) }, { name: new RegExp('^\\s*' + escRx(mapped.name) + '\\s*$', 'i') }] });
    if (!project) {
      for (let i = 0; i < 50; i++) {
        try { project = await Project.create({ ...mapped, id: await nextProjectId(), creationDate: new Date().toISOString().slice(0, 10) }); break; }
        catch (e) { if (e && e.code === 11000) continue; throw e; }
      }
    }
    if (!project) return res.status(500).json({ message: 'Could not create the project' });
    await ensureClientOrder(project);   // appears in Payment Progress automatically

    const actor = actorOf(req);
    const now = new Date();
    await SalesHandover.updateOne({ _id: h._id }, {
      $set: { procStatus: 'accepted', procReviewedBy: actor, procReviewedAt: now, procProjectId: project.id },
      $push: { procHistory: { status: 'Accepted by Procurement', by: actor, at: now, note: 'Project ' + project.id + ' added to Projects' } },
    });
    await notifyHandover('sales', h, `Handover ${h.ref || ''} accepted`, `${actor.name} accepted the handover. Project ${project.id} was added to Procurement Projects.`);
    res.json({ ok: true, projectId: project.id, project });
  } catch (err) { res.status(400).json({ message: err.message }); }
});

// POST /api/sales-handovers/:id/reject — Procurement rejects a handover (reason mandatory).
// No project is created; the reason is recorded and sent back to Sales. Does not touch the
// Sales→Execution workflow.
router.post('/:id/reject', blockPurchaseManager, async (req, res) => {
  try {
    const reason = String((req.body || {}).reason || '').trim();
    if (!reason) return res.status(400).json({ message: 'A rejection reason is required.' });
    const h = await SalesHandover.findById(req.params.id).lean();
    if (!h) return res.status(404).json({ message: 'Handover not found' });
    if (h.procStatus === 'accepted') return res.status(409).json({ message: 'This handover is already accepted and cannot be rejected.' });

    const actor = actorOf(req);
    const now = new Date();
    await SalesHandover.updateOne({ _id: h._id }, {
      $set: { procStatus: 'rejected', procReviewedBy: actor, procReviewedAt: now, procRejectReason: reason },
      $push: { procHistory: { status: 'Rejected by Procurement', by: actor, at: now, note: reason } },
    });
    await notifyHandover('sales', h, `Handover ${h.ref || ''} rejected`, `${actor.name} rejected the handover. Reason: ${reason}`);
    res.json({ ok: true });
  } catch (err) { res.status(400).json({ message: err.message }); }
});

module.exports = router;
