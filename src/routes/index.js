const router = require('express').Router();
const authRoutes = require('./auth.routes');
const supplierRoutes = require('./supplier.routes');
const orderRoutes = require('./order.routes');
const invoiceRoutes = require('./invoice.routes');
const paymentRoutes = require('./payment.routes');
const projectRoutes = require('./project.routes');
const projectPaymentRoutes = require('./projectPayment.routes');
const challanRoutes = require('./challan.routes');

router.get('/health', (req, res) => res.json({ status: 'ok', service: 'purchase-manager', time: new Date().toISOString() }));
router.use('/auth', authRoutes);
router.use('/suppliers', supplierRoutes);
router.use('/orders', orderRoutes);
router.use('/invoices', invoiceRoutes);
router.use('/payments', paymentRoutes);
router.use('/projects', projectRoutes);
router.use('/project-payments', projectPaymentRoutes);
router.use('/challans', challanRoutes);

module.exports = router;
