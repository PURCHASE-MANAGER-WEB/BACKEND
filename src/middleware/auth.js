const jwt = require('jsonwebtoken');
const PurchaseManager = require('../models/PurchaseManager');

// Verifies "Authorization: Bearer <token>". Tokens are signed with the SHARED
// JWT_SECRET, so both a Purchase Manager token (issued here) and a Sales Head
// token (issued by the Head backend) validate. We trust the signed `role` claim.
const protect = async (req, res, next) => {
  try {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.split(' ')[1] : null;
    if (!token) return res.status(401).json({ success: false, message: 'Not authenticated. Please login.' });

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.auth = { id: decoded.id, role: decoded.role };

    // Purchase Manager and Accounts Manager are both stored in purchase_managers —
    // confirm the account still exists and is active, and re-derive the access role
    // from the account's designation so a stale/tampered token role cannot elevate.
    if (decoded.role === 'purchase_manager' || decoded.role === 'accounts_manager') {
      const pm = await PurchaseManager.findById(decoded.id);
      if (!pm || !pm.isActive) {
        return res.status(401).json({ success: false, message: 'Account no longer exists or is deactivated.' });
      }
      req.pm = pm;
      req.auth.role = PurchaseManager.roleForDesignation(pm.designation);
    }
    next();
  } catch (err) {
    return res.status(401).json({ success: false, message: 'Session expired or invalid. Please login again.' });
  }
};

// Role guard — e.g. restrictTo('purchase_manager', 'Sales Head')
const restrictTo = (...roles) => (req, res, next) => {
  if (!req.auth || !roles.includes(req.auth.role)) {
    return res.status(403).json({ success: false, message: 'You do not have permission for this action.' });
  }
  next();
};

module.exports = { protect, restrictTo };
