const express = require('express');
const router = express.Router();
const reportController = require('../controllers/reportController');
const { authenticateToken } = require('../middlewares/auth');

// Dashboard Overview
router.get('/dashboard', authenticateToken, reportController.getDashboardMetrics);

// Contract Analytics
router.get('/contracts/summary', authenticateToken, reportController.getContractSummary);
router.get('/contracts/trends', authenticateToken, reportController.getContractTrends);
router.get('/contracts/by-status', authenticateToken, reportController.getContractsByStatus);
router.get('/contracts/by-department', authenticateToken, reportController.getContractsByDepartment);
router.get('/contracts/expiring', authenticateToken, reportController.getExpiringContracts);

// Period Analytics
router.get('/periods/summary', authenticateToken, reportController.getPeriodSummary);
router.get('/periods/overdue', authenticateToken, reportController.getOverduePeriods);
router.get('/periods/upcoming', authenticateToken, reportController.getUpcomingPeriods);
router.get('/periods/performance', authenticateToken, reportController.getPeriodPerformance);

// Financial Analytics
router.get('/financial/summary', authenticateToken, reportController.getFinancialSummary);
router.get('/financial/by-department', authenticateToken, reportController.getFinancialByDepartment);
router.get('/financial/trends', authenticateToken, reportController.getFinancialTrends);

// Department Analytics
router.get('/departments/performance', authenticateToken, reportController.getDepartmentPerformance);
router.get('/departments/comparison', authenticateToken, reportController.getDepartmentComparison);

// Export Reports
router.post('/export/excel', authenticateToken, reportController.exportToExcel);
router.post('/export/pdf', authenticateToken, reportController.exportToPDF);

// Custom Reports
router.post('/custom', authenticateToken, reportController.generateCustomReport);

module.exports = router;
