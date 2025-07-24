const express = require('express');
const router = express.Router();
const periodController = require('../controllers/periodController');
const authMiddleware = require('../middlewares/auth');

// ดึงข้อมูลงวดงานทั้งหมด (สำหรับการแจ้งเตือน)
router.get('/', authMiddleware, periodController.getAllPeriods);

module.exports = router;
