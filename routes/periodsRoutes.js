const express = require('express');
const router = express.Router();
const periodController = require('../controllers/periodController');
const authMiddleware = require('../middlewares/auth');

// ดึงข้อมูลงวดงานทั้งหมด (สำหรับการแจ้งเตือน)
router.get('/alerts', authMiddleware, periodController.getAllPeriods);

// ดึงข้อมูลงวดงานทั้งหมด (สำหรับ Frontend)
router.get('/', authMiddleware, periodController.getAllPeriodsSimple);

// อัปเดตงวดงาน
router.put('/:id', authMiddleware, periodController.updatePeriod);

// ลบงวดงาน
router.delete('/:id', authMiddleware, periodController.deletePeriod);

module.exports = router;
