const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');

// เข้าสู่ระบบ
router.post('/login', userController.login);

// สมัครสมาชิก
router.post('/register', userController.register);
 
module.exports = router; 