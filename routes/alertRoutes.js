const express = require('express');
const router = express.Router();
const auth = require('../middlewares/auth');
const alertService = require('../services/alertService');
const statusUpdateService = require('../services/statusUpdateService');

// ตรวจสอบสัญญาที่ใกล้หมดอายุ
router.get('/contracts/expiring', auth, async (req, res) => {
  try {
    const days = parseInt(req.query.days) || 7;
    const contracts = await alertService.checkExpiringContracts(days);
    res.json({
      success: true,
      count: contracts.length,
      contracts: contracts
    });
  } catch (error) {
    console.error('Error checking expiring contracts:', error);
    res.status(500).json({ error: error.message });
  }
});

// ตรวจสอบงวดงานที่ใกล้ถึงกำหนด
router.get('/periods/upcoming', auth, async (req, res) => {
  try {
    const periods = await alertService.checkUpcomingPeriods();
    res.json({
      success: true,
      count: periods.length,
      periods: periods
    });
  } catch (error) {
    console.error('Error checking upcoming periods:', error);
    res.status(500).json({ error: error.message });
  }
});

// รัน alert แบบ manual (admin only)
router.post('/run', auth, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }
    
    const result = await alertService.runDailyAlerts();
    res.json(result);
  } catch (error) {
    console.error('Error running manual alerts:', error);
    res.status(500).json({ error: error.message });
  }
});

// อัปเดตสถานะแบบ manual (admin only)
router.post('/status-update', auth, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }
    
    const { contractId } = req.body;
    const result = await statusUpdateService.manualStatusUpdate(contractId);
    res.json(result);
  } catch (error) {
    console.error('Error running manual status update:', error);
    res.status(500).json({ error: error.message });
  }
});

// ดูสรุปสถานะปัจจุบัน
router.get('/status-summary', auth, async (req, res) => {
  try {
    const summary = await statusUpdateService.getStatusSummary();
    res.json(summary);
  } catch (error) {
    console.error('Error getting status summary:', error);
    res.status(500).json({ error: error.message });
  }
});

// ทดสอบส่งอีเมล (admin only)
router.post('/test-email', auth, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }
    
    const { to, subject, content } = req.body;
    
    if (!to || !subject || !content) {
      return res.status(400).json({ error: 'Missing required fields: to, subject, content' });
    }
    
    const result = await alertService.sendAlertEmail(to, subject, content);
    res.json(result);
  } catch (error) {
    console.error('Error sending test email:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
