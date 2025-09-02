const express = require('express');
const router = express.Router();
const reportController = require('../controllers/reportController');
const auth = require('../middleware/auth');

// Apply auth middleware to all routes
router.use(auth);

// Report endpoints
router.get('/dashboard', reportController.getDashboardStats);
router.get('/contracts', reportController.getContractReports);
router.get('/periods', reportController.getPeriodReports);
router.get('/period-analysis', reportController.getPeriodAnalysis);
router.get('/performance', reportController.getPerformanceMetrics);
router.get('/export', reportController.exportReport);

module.exports = router;
