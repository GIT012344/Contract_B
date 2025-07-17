const db = require('../db');
const logService = require('../services/logService');

exports.listPeriods = async (req, res) => {
  const contractId = req.params.contractId;
  try {
    const result = await db.query('SELECT * FROM contract_periods WHERE contract_id = $1 ORDER BY period_no', [contractId]);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.addPeriod = async (req, res) => {
  const contractId = req.params.contractId;
  const { periodNo, dueDate } = req.body;
  try {
    const result = await db.query(
      'INSERT INTO contract_periods (contract_id, period_no, due_date) VALUES ($1, $2, $3) RETURNING *',
      [contractId, periodNo, dueDate]
    );
    logService.log('PERIOD_ADD', contractId, req.user.username, { periodNo, dueDate });
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.updatePeriod = async (req, res) => {
  const id = req.params.id;
  const { periodNo, dueDate } = req.body;
  try {
    const result = await db.query(
      'UPDATE contract_periods SET period_no = $1, due_date = $2 WHERE id = $3 RETURNING *',
      [periodNo, dueDate, id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    logService.log('PERIOD_UPDATE', id, req.user.username, { periodNo, dueDate });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.deletePeriod = async (req, res) => {
  const id = req.params.id;
  try {
    const result = await db.query('DELETE FROM contract_periods WHERE id = $1 RETURNING *', [id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    logService.log('PERIOD_DELETE', id, req.user.username, {});
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}; 