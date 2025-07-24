const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const authMiddleware = require('../middlewares/auth');

// การตั้งค่าการแจ้งเตือน
router.get('/notifications', authMiddleware, userController.getNotificationSettings);

// การตั้งค่าระบบ
router.get('/system', authMiddleware, userController.getSystemSettings);

module.exports = router;
