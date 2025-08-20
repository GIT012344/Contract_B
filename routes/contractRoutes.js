const express = require('express');
const router = express.Router();
const contractController = require('../controllers/contractController');
const multer = require('multer');
const config = require('../config/config');
const upload = multer({ dest: config.UPLOAD_PATH });
const auth = require('../middlewares/auth');
const { requireRole } = require('../middlewares/role');

router.use(auth);
router.get('/', contractController.listContracts);
router.get('/search', contractController.searchContracts);
router.get('/:id', contractController.getContract);
router.get('/:id/files', contractController.listFiles);
router.delete('/:id/files/:fileId', requireRole('admin'), contractController.deleteFile);
router.post('/', requireRole('admin'), contractController.createContract);
router.put('/:id', requireRole('admin'), contractController.updateContract);
router.delete('/:id', requireRole('admin'), contractController.deleteContract);
router.post('/:id/upload', requireRole('admin'), upload.array('files', 5), contractController.uploadFiles);

module.exports = router;