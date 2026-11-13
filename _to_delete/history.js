const CreationHistory = require('../models/CreationHistory');

// Record a creation event ONCE. $setOnInsert means a second call for the same key
// (an edit, a resave, a refresh) changes nothing — the original creator/date stay.
// Audit logging must never break the main create, so failures are swallowed.
async function logCreation({ key, recordType, refId, name, req, at }) {
  try {
    await CreationHistory.updateOne(
      { key },
      { $setOnInsert: {
          key, recordType,
          refId: String(refId || ''),
          name: String(name || ''),
          createdByName: (req && req.pm && req.pm.name) || (req && req.auth && req.auth.role) || 'User',
          createdByRole: (req && req.auth && req.auth.role) || '',
          at: at ? new Date(at) : new Date(),
        } },
      { upsert: true }
    );
  } catch (e) { /* non-fatal */ }
}

module.exports = { logCreation };
