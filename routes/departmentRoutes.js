const express = require('express');
const router = express.Router();
const departmentController = require('../controllers/departmentController');
const auth = require('../middlewares/auth');

// Public endpoint for registration - no auth required
router.get('/public', departmentController.getDepartmentsPublic);

// ดึงรายการแผนกสำหรับผู้ใช้ทั่วไป (active departments only)
router.get('/', auth, departmentController.getDepartments);

// ดึงรายการแผนกทั้งหมด (Admin only)
router.get('/all', auth, departmentController.getAllDepartments);

// สร้างแผนกใหม่ (Admin only)
router.post('/', auth, departmentController.createDepartment);

// อัปเดตข้อมูลแผนก (Admin only)
router.put('/:id', auth, departmentController.updateDepartment);

// ลบแผนก (Admin only)
router.delete('/:id', auth, departmentController.deleteDepartment);

// ดึงข้อมูลแผนกตาม ID
router.get('/:id', auth, departmentController.getDepartmentById);

// ดึงสมาชิกในแผนก
router.get('/:id/members', auth, departmentController.getDepartmentMembers);

// ดึงสัญญาของแผนก
router.get('/:id/contracts', auth, departmentController.getDepartmentContracts);


module.exports = router;
