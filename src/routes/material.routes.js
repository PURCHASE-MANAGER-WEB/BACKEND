// Material Requests from the Execution Portal — shared `material_requests` collection.
// Approval workflow: the Execution Head raises a request (Pending Approval); the Purchase
// Manager Approves or Rejects (reason mandatory); once Approved, a Purchase Order can be
// created from it (→ PO Created). The Execution requester is notified back via the shared
// doc's `requesterSeen` flag (their bell reads it); `procurementSeen` drives this portal's bell.
const router = require('express').Router();
const MaterialRequest = require('../models/MaterialRequest');
const PurchaseOrder = require('../models/PurchaseOrder');
const { protect, restrictTo } = require('../middleware/auth');

// Only the Purchase Manager / Purchase Head / Accounts Manager / Sales Head may act.
const CAN = ['purchase_manager', 'accounts_manager', 'Sales Head'];
router.use(protect, restrictTo(...CAN));

const STATUSES = ['Pending Approval', 'Approved', 'PO Created', 'Rejected'];
const actor = (req) => ({ id: (req.pm && String(req.pm._id)) || req.auth.id || '', name: (req.pm && req.pm.name) || req.auth.role || 'Procurement', role: req.auth.role || 'purchase_manager', portal: 'procurement' });
const log = (m, to, by, note) => { m.statusLog = [...(m.statusLog || []), { to, by: by.name, portal: 'procurement', at: new Date(), note: note || '' }]; };

// ---- Count of new/unseen requests (drives the sidebar badge) ----
router.get('/new-count', async (req, res) => {
  try { res.json({ count: await MaterialRequest.countDocuments({ procurementSeen: false }) }); }
  catch (err) { res.status(500).json({ message: err.message }); }
});

// ---- Notifications for the Purchase Manager bell (unseen first, newest first) ----
router.get('/notifications', async (req, res) => {
  try {
    const list = await MaterialRequest.find({}).sort({ procurementSeen: 1, updatedAt: -1, createdAt: -1 }).limit(30);
    const items = list.map((m) => ({
      id: String(m._id),
      unread: !m.procurementSeen,
      status: m.status,
      title: m.status === 'Pending Approval' ? `New material request — ${m.projectName || 'Project'}` : `Material ${String(m.status).toLowerCase()} — ${m.projectName || 'Project'}`,
      message: `${m.material}${m.qty ? ` · Qty ${m.qty}${m.unit ? ' ' + m.unit : ''}` : ''}${m.ref ? ` · ${m.ref}` : ''}`,
      requestedAt: m.createdAt,
      by: (m.createdBy && m.createdBy.name) || '',
    }));
    res.json({ items, unread: items.filter((i) => i.unread).length });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// ---- List all requests (newest first); optional ?status= and ?project= ----
router.get('/', async (req, res) => {
  try {
    const q = {};
    if (req.query.status && STATUSES.includes(req.query.status)) q.status = req.query.status;
    if (req.query.project) q.projectName = req.query.project;
    res.json(await MaterialRequest.find(q).sort({ createdAt: -1 }).limit(500));
  } catch (err) { res.status(500).json({ message: err.message }); }
});

router.get('/:id', async (req, res) => {
  try {
    const m = await MaterialRequest.findById(req.params.id);
    if (!m) return res.status(404).json({ message: 'Request not found' });
    res.json(m);
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// ---- Mark every request as seen by Procurement (clears the badge) ----
router.post('/seen', async (req, res) => {
  try { await MaterialRequest.updateMany({ procurementSeen: false }, { $set: { procurementSeen: true } }); res.json({ ok: true }); }
  catch (err) { res.status(500).json({ message: err.message }); }
});

// ---- Approve a pending request ----
router.patch('/:id/approve', async (req, res) => {
  try {
    const m = await MaterialRequest.findById(req.params.id);
    if (!m) return res.status(404).json({ message: 'Request not found' });
    if (m.status !== 'Pending Approval') return res.status(400).json({ message: `Only a pending request can be approved (this one is "${m.status}")` });
    const by = actor(req);
    m.status = 'Approved';
    m.rejectReason = '';
    m.decidedBy = by; m.decidedAt = new Date();
    log(m, 'Approved', by);
    m.procurementSeen = true;
    m.requesterSeen = false;   // notify the Execution requester
    await m.save();
    res.json(m);
  } catch (err) { res.status(400).json({ message: err.message }); }
});

// ---- Reject a request (reason mandatory) ----
router.patch('/:id/reject', async (req, res) => {
  try {
    const reason = String((req.body || {}).rejectReason || '').trim();
    if (!reason) return res.status(400).json({ message: 'A reason is required to reject a requirement' });
    const m = await MaterialRequest.findById(req.params.id);
    if (!m) return res.status(404).json({ message: 'Request not found' });
    if (m.status === 'PO Created') return res.status(400).json({ message: 'A request with a PO can no longer be rejected' });
    if (m.status === 'Rejected') return res.status(400).json({ message: 'This request is already rejected' });
    const by = actor(req);
    m.status = 'Rejected';
    m.rejectReason = reason;
    m.decidedBy = by; m.decidedAt = new Date();
    log(m, 'Rejected', by, reason);
    m.procurementSeen = true;
    m.requesterSeen = false;   // notify the Execution requester with the reason
    await m.save();
    res.json(m);
  } catch (err) { res.status(400).json({ message: err.message }); }
});

// ---- Create a Purchase Order from an APPROVED request (→ PO Created) ----
// Guards: only when Approved, and never twice (no duplicate PO for the same request).
router.post('/:id/convert', async (req, res) => {
  try {
    const m = await MaterialRequest.findById(req.params.id);
    if (!m) return res.status(404).json({ message: 'Request not found' });
    if (m.status === 'PO Created' || (m.poRef && String(m.poRef).trim())) {
      return res.status(409).json({ message: `A purchase order (${m.poRef || 'existing'}) has already been created for this request` });
    }
    if (m.status !== 'Approved') return res.status(400).json({ message: `Approve the request before creating a PO (this one is "${m.status}")` });

    const b = req.body || {};
    const po = String(b.po || '').trim().toUpperCase();
    if (!po) return res.status(400).json({ message: 'Enter the PO number to create' });

    const line = {
      id: `MRL-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      po,
      poDate: b.poDate || new Date().toISOString().slice(0, 10),
      vid: b.vid || '',
      project: m.projectName || '',
      material: m.material || '',
      spec: m.spec || '',
      qty: Number(m.qty) || 0,
      unit: m.unit || '',
      rate: Number(b.rate) || 0,
      received: 0,
      paid: 0,
    };
    await PurchaseOrder.create(line);

    const by = actor(req);
    m.poRef = po;
    m.status = 'PO Created';
    m.decidedBy = by; m.decidedAt = new Date();
    log(m, 'PO Created', by, `Purchase order ${po} created`);
    m.procurementSeen = true;
    m.requesterSeen = false;   // notify the Execution requester
    await m.save();
    res.status(201).json({ request: m, po: line.po });
  } catch (err) {
    if (err && err.code === 11000) return res.status(409).json({ message: 'That PO line id already exists — try again' });
    res.status(400).json({ message: err.message });
  }
});

module.exports = router;
