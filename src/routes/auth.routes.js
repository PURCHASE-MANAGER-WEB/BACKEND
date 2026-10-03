// Purchase Manager authentication — login / me / logout / password-reset.
const router = require('express').Router();
const jwt = require('jsonwebtoken');
const PurchaseManager = require('../models/PurchaseManager');
const { protect } = require('../middleware/auth');

const signToken = (pm) =>
  jwt.sign({ id: pm._id, role: 'purchase_manager' }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '1d',
  });

// POST /api/auth/login  { email (or employeeId), password }
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body || {};
    if (!email || !password) return res.status(400).json({ success: false, message: 'Please fill in all fields' });

    const identifier = String(email).trim();
    const pm = await PurchaseManager.findOne({
      $or: [{ email: identifier.toLowerCase() }, { employeeId: identifier }],
    }).select('+password');

    if (!pm || !(await pm.comparePassword(password))) {
      return res.status(401).json({ success: false, message: 'Invalid email or password' });
    }
    if (!pm.isActive) {
      return res.status(403).json({ success: false, message: 'Account is deactivated. Contact the Sales Head.' });
    }

    pm.lastLoginAt = new Date();
    await pm.save({ validateBeforeSave: false });

    return res.json({ success: true, message: 'Login successful', token: signToken(pm), user: pm.toSafeJSON() });
  } catch (err) {
    console.error('PM login error:', err);
    return res.status(500).json({ success: false, message: 'Server error during login' });
  }
});

// GET /api/auth/me  (protected)
router.get('/me', protect, async (req, res) => {
  if (req.auth.role !== 'purchase_manager' || !req.pm) {
    return res.status(403).json({ success: false, message: 'Not a Purchase Manager session.' });
  }
  return res.json({ success: true, user: req.pm.toSafeJSON() });
});

// POST /api/auth/logout  (JWT is stateless; client drops the token)
router.post('/logout', protect, (req, res) => res.json({ success: true, message: 'Logged out' }));

// --- Password reset (OTP). Email delivery can be wired later; until then the OTP
// is returned as devOtp in non-production so the flow is usable. ---
router.post('/forgot-password', async (req, res) => {
  try {
    const { email } = req.body || {};
    if (!email) return res.status(400).json({ success: false, message: 'Please enter your email ID' });
    const pm = await PurchaseManager.findOne({ email: String(email).toLowerCase().trim() });
    if (!pm) return res.status(404).json({ success: false, message: 'No Purchase Manager account with this email' });

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    pm.resetOtp = otp;
    pm.resetOtpExpires = new Date(Date.now() + 10 * 60 * 1000);
    await pm.save({ validateBeforeSave: false });

    const payload = { success: true, message: 'OTP generated.' };
    if (process.env.NODE_ENV !== 'production') payload.devOtp = otp; // convenience until email is configured
    return res.json(payload);
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

router.post('/verify-otp', async (req, res) => {
  try {
    const { email, otp } = req.body || {};
    const pm = await PurchaseManager.findOne({ email: String(email || '').toLowerCase().trim() }).select('+resetOtp +resetOtpExpires');
    if (!pm || !pm.resetOtp || pm.resetOtp !== String(otp)) return res.status(400).json({ success: false, message: 'Invalid OTP' });
    if (pm.resetOtpExpires < new Date()) return res.status(400).json({ success: false, message: 'OTP has expired' });
    return res.json({ success: true, message: 'OTP verified' });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

router.post('/reset-password', async (req, res) => {
  try {
    const { email, otp, newPassword } = req.body || {};
    if (!newPassword || String(newPassword).length < 8) return res.status(400).json({ success: false, message: 'Password must be at least 8 characters' });
    const pm = await PurchaseManager.findOne({ email: String(email || '').toLowerCase().trim() }).select('+password +resetOtp +resetOtpExpires');
    if (!pm || !pm.resetOtp || pm.resetOtp !== String(otp)) return res.status(400).json({ success: false, message: 'Invalid OTP' });
    if (pm.resetOtpExpires < new Date()) return res.status(400).json({ success: false, message: 'OTP has expired' });
    pm.password = newPassword; // hashed by pre-save
    pm.resetOtp = undefined;
    pm.resetOtpExpires = undefined;
    await pm.save();
    return res.json({ success: true, message: 'Password reset successfully' });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
