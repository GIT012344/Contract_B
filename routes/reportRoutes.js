const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middlewares/auth');
const reportController = require('../controllers/reportController');

// All routes require authentication
router.use(authenticateToken);

// Dashboard statistics
router.get('/dashboard-stats', reportController.getDashboardStats);

// Department analysis
router.get('/department-stats', reportController.getDepartmentStats);

// Timeline analysis
router.get('/timeline-analysis', reportController.getTimelineAnalysis);

// Financial summary
router.get('/financial-summary', reportController.getFinancialSummary);

// Top contractors
router.get('/top-contractors', reportController.getTopContractors);

// Alert summary
router.get('/alert-summary', reportController.getAlertSummary);

// Performance metrics
router.get('/performance-metrics', reportController.getPerformanceMetrics);

// Export report
router.get('/export', reportController.exportReport);

module.exports = router;
