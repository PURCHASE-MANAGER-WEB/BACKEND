// Creation history API — purchase_creation_history, merged with existing records'
// real DB createdAt so projects/POs created before logging still appear (no invented dates).
const router = require('express').Router();
const CreationHistory = require('../models/CreationHistory');
const Project = require('../models/Project');
const PurchaseOrder = require('../models/PurchaseOrder');
const { protect, restrictTo } = require('../middleware/auth');

const CAN = ['purchase_manager', 'Sales Head', 'accounts_manager'];
router.use(protect, restrictTo(...CAN));

router.get('/', async (req, res) => {
  try {
    const { type, from, to, user } = req.query || {};
    const logs = await CreationHistory.find().lean();
    const have = new Set(logs.map((l) => l.key));
    const entries = logs.map((l) => ({
      recordType: l.recordType, refId: l.refId, name: l.name,
      createdByName: l.createdByName || '', createdByRole: l.createdByRole || '', at: l.at,
    }));

    // Derive entries for projects with no log yet (use real createdAt).
    const projects = await Project.find().select('id name createdAt').lean();
    for (const p of projects) {
      if (!have.has('project:' + p.id)) entries.push({ recordType: 'Project', refId: p.id, name: p.name, createdByName: '', createdByRole: '', at: p.createdAt });
    }
    // Derive entries for POs with no log yet (earliest line createdAt per PO).
    const lines = await PurchaseOrder.find().select('po createdAt').lean();
    const firstAt = new Map();
    for (const l of lines) { const cur = firstAt.get(l.po); if (!cur || new Date(l.createdAt) < new Date(cur)) firstAt.set(l.po, l.createdAt); }
    for (const [po, at] of firstAt) { if (!have.has('po:' + po)) entries.push({ recordType: 'Purchase Order', refId: po, name: po, createdByName: '', createdByRole: '', at }); }

    let out = entries.filter((e) => e.at);
    if (type) out = out.filter((e) => e.recordType === type);
    if (user) { const u = String(user).toLowerCase(); out = out.filter((e) => String(e.createdByName || '').toLowerCase().includes(u)); }
    if (from) { const f = new Date(from); out = out.filter((e) => new Date(e.at) >= f); }
    if (to) { const t = new Date(to); t.setHours(23, 59, 59, 999); out = out.filter((e) => new Date(e.at) <= t); }
    out.sort((a, b) => new Date(b.at) - new Date(a.at));
    res.json(out);
  } catch (err) { res.status(500).json({ message: err.message }); }
});

module.exports = router;
