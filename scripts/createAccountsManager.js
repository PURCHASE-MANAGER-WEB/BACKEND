// One-off helper to create (or promote) an Accounts Manager login for the Purchase
// portal. Accounts Managers live in the SAME `purchase_managers` collection as
// Purchase Managers — the only difference is designation: 'Accounts Manager', which
// the backend turns into the accounts_manager access role on login.
//
// Usage (run from the backend folder, with the backend .env present):
//   node scripts/createAccountsManager.js <email> <password> ["Full Name"]
//
// - If an account with that email already exists, it is promoted to Accounts Manager
//   (and its password/name updated if provided) — existing data is untouched.
// - Otherwise a new active Accounts Manager account is created.
// Password is hashed by the model's pre-save hook, exactly like every other account.
require('dotenv').config();
const mongoose = require('mongoose');
const PurchaseManager = require('../src/models/PurchaseManager');

(async () => {
  const [, , emailArg, passwordArg, ...nameParts] = process.argv;
  const email = String(emailArg || '').toLowerCase().trim();
  const password = passwordArg || '';
  const name = nameParts.join(' ').trim() || 'Accounts Manager';

  if (!email || !password) {
    console.error('Usage: node scripts/createAccountsManager.js <email> <password> ["Full Name"]');
    process.exit(1);
  }
  if (password.length < 6) {
    console.error('Password must be at least 6 characters.');
    process.exit(1);
  }
  if (!process.env.MONGO_URI) {
    console.error('MONGO_URI is not set. Run this from the backend folder with its .env present.');
    process.exit(1);
  }

  await mongoose.connect(process.env.MONGO_URI);
  try {
    let pm = await PurchaseManager.findOne({ email }).select('+password');
    if (pm) {
      pm.designation = 'Accounts Manager';
      if (password) pm.password = password;       // re-hashed by pre-save
      if (nameParts.length) pm.name = name;
      pm.isActive = true;
      await pm.save();
      console.log(`Promoted existing account to Accounts Manager: ${email}`);
    } else {
      pm = await PurchaseManager.create({
        name, email, password, designation: 'Accounts Manager', isActive: true,
      });
      console.log(`Created Accounts Manager account: ${email}`);
    }
    console.log('Login with Role = "Accounts Manager" and these credentials.');
  } catch (err) {
    console.error('Failed:', err.message);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
})();
