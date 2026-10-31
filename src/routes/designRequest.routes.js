// Procurement ⇄ Design CRM bridge. Raises design requests into the shared
// `design_requests` collection (the Design CRM picks them up automatically) and
// reads back status + approved files. Same auth as the other procurement routes.
const router = require('express').Router();
const DesignRequest = require('../models/DesignRequest');
const DesignFile = require('../models/DesignFile');
const DesignNotification = require('../models/DesignNotification');
const Project = require('../models/Project');
const { protect, restrictTo } = require('../middleware/auth');

// Purchase Manager, Purchase Head (purchase_manager role) and Sales Head may raise
// and track design requests.
const CAN = ['purchase_manager', 'Sales Head', 'accounts_manager'];
router.use(protect, restrictTo(...CAN));

const MAX = 12 * 1024 * 1024;

const nextId = async () => {
  const year = new Date().getFullYear();
  const re = new RegExp('^REQ-' + year + '-(\\d+)$');
  const rows = await DesignRequest.find({ id: re }).select('id').lean();
  const max = rows.reduce((m, r) => { const n = parseInt(String(r.id).split('-').pop(), 10); return (Number.isFinite(n) && n > m) ? n : m; }, 0);
  return 'REQ-' + year + '-' + String(max + 1).padStart(3, '0');
};

// GET /api/design-requests/files/:id — stream an attachment or approved design file.
router.get('/files/:id', async (req, res) => {
  try {
    const doc = await DesignFile.findById(req.params.id);
    if (!doc || !doc.data) return res.status(404).json({ message: 'File not found.' });
    const disp = req.query.download ? 'attachment' : 'inline';
    const safe = (doc.name || 'file').replace(/[^\w.\-]+/g, '_');
    res.set('Content-Type', doc.type || 'application/octet-stream');
    res.set('Content-Disposition', `${disp}; filename="${safe}"`);
    res.set('Cache-Control', 'private, max-age=60');
    res.send(doc.data);
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// POST /api/design-requests — raise a design request. Body: projectName, customerName,
// procurementProjectId, procurementProjectCode, requirement, description, dueDate, priority, projectType.
router.post('/', async (req, res) => {
  try {
    const b = { ...(req.body || {}) };
    delete b._id; delete b.id;

    // Pull the full project from purchase_projects (shared DB) and embed a snapshot
    // so the Design CRM shows complete project details without anyone re-typing them.
    let proj = null;
    try {
      if (b.procurementProjectId) proj = await Project.findOne({ id: b.procurementProjectId }).lean();
      if (!proj && b.procurementProjectCode) proj = await Project.findOne({ code: b.procurementProjectCode }).lean();
      if (!proj && b.projectName) proj = await Project.findOne({ name: b.projectName }).lean();
    } catch { /* non-fatal */ }
    if (proj) {
      if (!b.customerName) b.customerName = proj.client || '';
      if (!b.location) b.location = proj.projectLocation || proj.siteAddress || '';
      if (!b.projectType) b.projectType = proj.typeOfProject || b.projectType || '';
      if (!b.procurementProjectCode) b.procurementProjectCode = proj.code || '';
      b.projectSnapshot = {
        client: proj.client || '', location: proj.projectLocation || '', siteAddress: proj.siteAddress || '',
        typeOfProject: proj.typeOfProject || '', projectSize: proj.projectSize || '',
        materialDescription: proj.materialDescription || '', contactDetails: proj.contactDetails || proj.mobileNumber || '',
        salespersonName: proj.salespersonName || '', quotedPrice: proj.quotedPrice != null ? proj.quotedPrice : '',
        tentativeCompletionDate: proj.tentativeCompletionDate || '',
      };
    }

    for (let i = 0; i < 50; i++) {
      try {
        const doc = await DesignRequest.create({
          ...b,
          id: await nextId(),
          source: 'procurement',
          status: 'New',
          assignedDesigner: 'Unassigned',
          requestedByUser: (req.auth && req.auth.name) || b.requestedByUser || '',
          requestedBy: b.requestedBy || (((req.auth && req.auth.name) || 'Procurement') + ' (Procurement)'),
          history: [{ title: 'Design request raised from Procurement', time: new Date().toISOString().slice(0, 16).replace('T', ' '), desc: `${b.projectName || ''}${b.procurementProjectCode ? ' (' + b.procurementProjectCode + ')' : ''}` }],
        });

        // Notify the Design Head (into the shared design_notifications collection).
        try {
          const reqLabel = b.requirement || b.service || 'Design';
          await DesignNotification.create({
            audience: 'head',
            type: 'assignment',
            category: 'Assignments',
            title: 'New design request from Procurement',
            message: `${doc.projectName || doc.id}${doc.procurementProjectCode ? ' (' + doc.procurementProjectCode + ')' : ''} \u2014 ${reqLabel}${doc.priority ? ' \u00b7 ' + doc.priority : ''}${doc.dueDate ? ' \u00b7 due ' + doc.dueDate : ''}`,
            desc: `${doc.projectName || doc.id}${doc.procurementProjectCode ? ' (' + doc.procurementProjectCode + ')' : ''} \u2014 ${reqLabel}`,
            time: 'just now',
            read: false,
            requestId: doc.id,
            projectName: doc.projectName || '',
            projectCode: doc.procurementProjectCode || '',
          });
        } catch { /* notification failure must not fail the request */ }

        return res.status(201).json(doc.toObject());
      } catch (e) { if (e && e.code === 11000) continue; throw e; }
    }
    throw new Error('Could not allocate a request id.');
  } catch (err) { res.status(400).json({ message: err.message }); }
});

// GET /api/design-requests?projectId=PRJ-001 | projectCode=XX | project=NAME
router.get('/', async (req, res) => {
  try {
    const q = {};
    if (req.query.projectId) q.procurementProjectId = req.query.projectId;
    if (req.query.projectCode) q.procurementProjectCode = req.query.projectCode;
    if (req.query.project) q.projectName = req.query.project;
    const docs = await DesignRequest.find(q).sort({ createdAt: -1 }).lean();
    res.json(docs);
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// GET /api/design-requests/:id — one request (status + approved files).
router.get('/:id', async (req, res) => {
  try {
    const doc = await DesignRequest.findOne({ id: req.params.id }).lean();
    if (!doc) return res.status(404).json({ message: 'Request not found.' });
    res.json(doc);
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// POST /api/design-requests/:id/attachments — upload a supporting file (into design_files) and link it.
// Body: { name, type, size, dataBase64 }
router.post('/:id/attachments', async (req, res) => {
  try {
    const { name, type, size, dataBase64 } = req.body || {};
    if (!dataBase64) return res.status(400).json({ message: 'No file data received.' });
    const raw = String(dataBase64);
    const b64 = raw.includes(',') ? raw.split(',').pop() : raw;
    const buf = Buffer.from(b64, 'base64');
    if (!buf.length) return res.status(400).json({ message: 'The file appears to be empty.' });
    if (buf.length > MAX) return res.status(413).json({ message: 'That file is larger than 12 MB.' });
    const f = await DesignFile.create({ entity: 'request', entityId: req.params.id, name: name || 'file', type: type || 'application/octet-stream', size: size || buf.length, uploadedBy: (req.auth && req.auth.name) || '', data: buf });
    const sizeStr = size ? (Math.round((size / 1024 / 1024) * 10) / 10) + ' MB' : '';
    const doc = await DesignRequest.findOneAndUpdate(
      { id: req.params.id },
      { $push: { attachments: { name: name || 'file', size: sizeStr, type: type || '', fileId: String(f._id) } } },
      { new: true }
    );
    if (!doc) return res.status(404).json({ message: 'Request not found.' });
    res.json({ ok: true, fileId: String(f._id), request: doc.toObject() });
  } catch (err) { res.status(400).json({ message: err.message }); }
});

module.exports = router;
