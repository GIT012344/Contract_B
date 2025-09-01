const express = require('express');
const router = express.Router();
const reportController = require('../controllers/reportController');
const { authenticateToken } = require('../middlewares/auth');

// All routes require authentication
router.use(authenticateToken);

// Dashboard statistics
router.get('/dashboard', reportController.getDashboardStats);

// Contract reports with filters
router.get('/contracts', reportController.getContractReports);

// Financial reports
router.get('/financial', reportController.getFinancialReports);

// Period analysis
router.get('/periods', reportController.getPeriodAnalysis);

// Performance metrics
router.get('/performance', reportController.getPerformanceMetrics);

// Export report data
router.post('/export', reportController.exportReport);

module.exports = router;
