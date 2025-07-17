const express = require('express');
const router = express.Router({ mergeParams: true });
const periodController = require('../controllers/periodController');
const auth = require('../middlewares/auth');
const { requireRole } = require('../middlewares/role');

router.use(auth);
router.get('/:contractId/periods', periodController.listPeriods);
router.post('/:contractId/periods', requireRole('admin'), periodController.addPeriod);
router.put('/periods/:id', requireRole('admin'), periodController.updatePeriod);
router.delete('/periods/:id', requireRole('admin'), periodController.deletePeriod);

module.exports = router; 