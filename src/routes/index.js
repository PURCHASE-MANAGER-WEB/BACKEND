const router = require('express').Router();
const authRoutes = require('./auth.routes');
const supplierRoutes = require('./supplier.routes');
const orderRoutes = require('./order.routes');
const invoiceRoutes = require('./invoice.routes');

router.get('/health', (req, res) => res.json({ status: 'ok', service: 'purchase-manager', time: new Date().toISOString() }));
router.use('/auth', authRoutes);
router.use('/suppliers', supplierRoutes);
router.use('/orders', orderRoutes);
router.use('/invoices', invoiceRoutes);

module.exports = router;
