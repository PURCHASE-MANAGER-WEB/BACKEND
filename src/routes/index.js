const router = require('express').Router();
const authRoutes = require('./auth.routes');
const supplierRoutes = require('./supplier.routes');
const orderRoutes = require('./order.routes');
const invoiceRoutes = require('./invoice.routes');
const poFileRoutes = require('./poFiles.routes');
const paymentRoutes = require('./payment.routes');
const projectRoutes = require('./project.routes');
const projectPaymentRoutes = require('./projectPayment.routes');
const challanRoutes = require('./challan.routes');
const formRoutes = require('./form.routes');

router.get('/health', (req, res) => res.json({ status: 'ok', service: 'purchase-manager', time: new Date().toISOString() }));
router.use('/auth', authRoutes);
router.use('/suppliers', supplierRoutes);
router.use('/orders', orderRoutes);
router.use('/invoices', invoiceRoutes);
router.use('/files', poFileRoutes);
router.use('/payments', paymentRoutes);
router.use('/projects', projectRoutes);
router.use('/project-payments', projectPaymentRoutes);
router.use('/challans', challanRoutes);
router.use('/forms', formRoutes);

module.exports = router;
