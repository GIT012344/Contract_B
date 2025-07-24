const express = require('express');
const router = express.Router();
const activityLogController = require('../controllers/activityLogController');
const authMiddleware = require('../middlewares/auth');
const { requireRole } = require('../middlewares/role');

// ดูรายการ Activity Logs ทั้งหมด (admin เท่านั้น)
router.get('/', authMiddleware, requireRole('admin'), activityLogController.getLogs);

// ดู Activity Logs ของผู้ใช้คนหนึ่ง (admin หรือ user ตัวเอง)
router.get('/user/:userId', authMiddleware, activityLogController.getUserLogs);

// ดูสถิติ Activity Logs (admin เท่านั้น)
router.get('/stats', authMiddleware, requireRole('admin'), activityLogController.getActivityStats);

module.exports = router;
