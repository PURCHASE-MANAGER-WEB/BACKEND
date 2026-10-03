const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

// Purchase Manager accounts — stored in their OWN collection, kept separate from
// the CRM `users` collection (Sales Head / Manager / BDE / Coordinator).
// Created by the Sales Head; read here for login/authentication.
const purchaseManagerSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, lowercase: true, trim: true, unique: true },
    employeeId: { type: String, trim: true },
    role: { type: String, default: 'purchase_manager' }, // fixed role value
    password: { type: String, required: true, minlength: 6, select: false },
    resetOtp: { type: String, select: false },
    resetOtpExpires: { type: Date, select: false },
    lastLoginAt: { type: Date },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true, collection: 'purchase_managers' } // explicit collection name
);

// Same bcrypt cost as the other CRM backends so hashes are cross-compatible
// (the Sales Head backend creates the account; this backend verifies the login).
purchaseManagerSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

purchaseManagerSchema.methods.comparePassword = function (candidate) {
  return bcrypt.compare(candidate, this.password);
};

purchaseManagerSchema.methods.toSafeJSON = function () {
  return {
    id: this._id,
    name: this.name,
    email: this.email,
    employeeId: this.employeeId,
    role: this.role || 'purchase_manager',
    isActive: this.isActive,
    lastLoginAt: this.lastLoginAt,
  };
};

module.exports = mongoose.model('PurchaseManager', purchaseManagerSchema);
