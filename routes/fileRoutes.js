const express = require('express');
const router = express.Router();
const fileController = require('../controllers/fileController');
const { authenticateToken } = require('../middlewares/auth');

// ใช้ auth middleware สำหรับทุก route
router.use(authenticateToken);

// อัปโหลดไฟล์สำหรับสัญญา
router.post('/contracts/:contractId/files', 
  fileController.uploadMiddleware, 
  fileController.uploadFiles
);

// ดึงรายการไฟล์ของสัญญา
router.get('/contracts/:contractId/files', fileController.getContractFiles);

// ดาวน์โหลดไฟล์
router.get('/files/:fileId/download', fileController.downloadFile);

// ดูไฟล์ (preview)
router.get('/files/:fileId/view', fileController.viewFile);

// ลบไฟล์
router.delete('/files/:fileId', fileController.deleteFile);

module.exports = router;
