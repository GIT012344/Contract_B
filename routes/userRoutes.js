const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const authMiddleware = require('../middlewares/auth');

// เข้าสู่ระบบ
router.post('/login', userController.login);

// สมัครสมาชิก
router.post('/register', userController.register);

// ดูข้อมูลโปรไฟล์ผู้ใช้ (ต้อง login)
router.get('/profile', authMiddleware, userController.getProfile);

// อัปเดตข้อมูลโปรไฟล์ผู้ใช้ (ต้อง login)
router.put('/profile', authMiddleware, userController.updateProfile);

module.exports = router;