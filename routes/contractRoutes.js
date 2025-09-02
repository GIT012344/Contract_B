const express = require('express');
const router = express.Router();
const contractController = require('../controllers/contractController');
const multer = require('multer');
const path = require('path');
const config = require('../config/config');

// Configure multer to handle Thai filenames properly
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, config.UPLOAD_PATH)
  },
  filename: function (req, file, cb) {
    // Fix Thai filename encoding issue
    const originalName = Buffer.from(file.originalname, 'latin1').toString('utf8');
    // Generate unique filename with timestamp
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(originalName);
    const nameWithoutExt = path.basename(originalName, ext);
    const finalName = nameWithoutExt + '-' + uniqueSuffix + ext;
    
    // Store the original Thai name in the file object for database storage
    file.thaiOriginalName = originalName;
    
    cb(null, finalName);
  }
});

const upload = multer({ storage: storage });
const auth = require('../middlewares/auth');
const { requireRole } = require('../middlewares/role');

router.use(auth);
router.get('/', contractController.listContracts);
router.get('/search', contractController.searchContracts);
router.get('/:id', contractController.getContract);
router.get('/:id/periods', contractController.getContractPeriods);
router.post('/:id/periods', requireRole('admin'), contractController.addContractPeriod);
router.put('/:id/periods/:periodId', requireRole('admin'), contractController.updateContractPeriod);
router.delete('/:id/periods/:periodId', requireRole('admin'), contractController.deleteContractPeriod);
router.get('/:id/files', contractController.listFiles);
router.delete('/:id/files/:fileId', requireRole('admin'), contractController.deleteFile);
router.post('/', contractController.createContract);
router.put('/:id', contractController.updateContract);
router.delete('/:id', contractController.deleteContract);
router.post('/:id/upload', requireRole('admin'), upload.array('files', 5), contractController.uploadFiles);

module.exports = router;