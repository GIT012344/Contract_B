const db = require('../db');
const logService = require('../services/logService');

exports.listContracts = async (req, res) => {
  try {
    const result = await db.query('SELECT * FROM contracts WHERE deleted_flag = FALSE ORDER BY id DESC');
    res.json(result.rows);
  } catch (err) {
    console.error('ERROR in listContracts:', err);
    res.status(500).json({ error: err.message });
  }
};

exports.getContract = async (req, res) => {
  try {
    const result = await db.query('SELECT * FROM contracts WHERE id = $1 AND deleted_flag = FALSE', [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error('ERROR in getContract:', err);
    res.status(500).json({ error: err.message });
  }
};

exports.createContract = async (req, res) => {
  try {
    const {
      contractNo, contractDate, contactName, department, startDate, endDate, periodCount,
      remark1, remark2, remark3, remark4, alertEmails, status
    } = req.body;
    if (!contractNo) {
      return res.status(400).json({ error: 'contractNo is required' });
    }
    const allowedStatus = ['CRTD', 'ACTIVE', 'EXPIRED', 'DELETED'];
    const statusToSave = allowedStatus.includes(status) ? status : 'CRTD';
    const result = await db.query(
      `INSERT INTO contracts (contract_no, contract_date, contact_name, department, start_date, end_date, period_count, remark1, remark2, remark3, remark4, alert_emails, status, created_by, updated_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$14) RETURNING *`,
      [contractNo, contractDate, contactName, department, startDate, endDate, periodCount, remark1, remark2, remark3, remark4, alertEmails, statusToSave, req.user.username]
    );
    logService.log('CREATE', result.rows[0].id, req.user.username, { contractNo });
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('ERROR in createContract:', err);
    res.status(500).json({ error: err.message });
  }
};

exports.updateContract = async (req, res) => {
  try {
    const id = req.params.id;
    const fields = [
      'contract_no', 'contract_date', 'contact_name', 'department', 'start_date', 'end_date', 'period_count',
      'remark1', 'remark2', 'remark3', 'remark4', 'alert_emails', 'status'
    ];
    const updates = [];
    const values = [];
    fields.forEach((f, i) => {
      if (req.body[f] !== undefined) {
        updates.push(`${f} = $${updates.length + 1}`);
        values.push(req.body[f]);
      }
    });
    if (updates.length === 0) return res.status(400).json({ error: 'No fields to update' });
    values.push(req.user.username); // updated_by
    values.push(id); // WHERE id
    const sql = `UPDATE contracts SET ${updates.join(', ')}, updated_by = $${updates.length + 1}, updated_at = CURRENT_TIMESTAMP WHERE id = $${updates.length + 2} AND deleted_flag = FALSE RETURNING *`;
    const result = await db.query(sql, values);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    logService.log('UPDATE', id, req.user.username, { contractNo: result.rows[0].contract_no });
    res.json(result.rows[0]);
  } catch (err) {
    console.error('ERROR in updateContract:', err);
    res.status(500).json({ error: err.message });
  }
};

exports.deleteContract = async (req, res) => {
  try {
    const id = req.params.id;
    const result = await db.query(
      `UPDATE contracts SET deleted_flag = TRUE, status = 'DELETED', updated_by = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 AND deleted_flag = FALSE RETURNING *`,
      [req.user.username, id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    logService.log('DELETE', id, req.user.username, { contractNo: result.rows[0].contract_no });
    res.json({ success: true });
  } catch (err) {
    console.error('ERROR in deleteContract:', err);
    res.status(500).json({ error: err.message });
  }
};

exports.uploadFiles = async (req, res) => {
  const contractId = req.params.id;
  try {
    // ตรวจสอบ contract
    const contractResult = await db.query('SELECT * FROM contracts WHERE id = $1 AND deleted_flag = FALSE', [contractId]);
    if (contractResult.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    // นับไฟล์เดิม
    const fileCountResult = await db.query('SELECT COUNT(*) FROM contract_files WHERE contract_id = $1', [contractId]);
    const currentCount = parseInt(fileCountResult.rows[0].count, 10);
    if (!req.files || req.files.length === 0) return res.status(400).json({ error: 'No files uploaded' });
    if ((currentCount + req.files.length) > 5) return res.status(400).json({ error: 'Maximum 5 files per contract' });
    // insert files
    for (const file of req.files) {
      await db.query(
        'INSERT INTO contract_files (contract_id, filename, path, mimetype) VALUES ($1, $2, $3, $4)',
        [contractId, file.originalname, file.path, file.mimetype]
      );
    }
    // log
    logService.log('UPLOAD', contractId, req.user.username, { files: req.files.map(f => f.originalname) });
    // คืนไฟล์แนบทั้งหมด
    const filesResult = await db.query('SELECT * FROM contract_files WHERE contract_id = $1 ORDER BY id', [contractId]);
    res.json({ success: true, files: filesResult.rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.listFiles = async (req, res) => {
  const contractId = req.params.id;
  try {
    const filesResult = await db.query('SELECT * FROM contract_files WHERE contract_id = $1 ORDER BY id', [contractId]);
    res.json(filesResult.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.searchContracts = async (req, res) => {
  const {
    contractNo, contractDate, contactName, department, startDate, endDate,
    periodDueStart, periodDueEnd, periodCount
  } = req.query;
  let sql = `SELECT DISTINCT c.* FROM contracts c`;
  const wheres = ['c.deleted_flag = FALSE'];
  const params = [];
  let joinPeriods = false;

  if (periodDueStart || periodDueEnd) {
    sql += ' JOIN contract_periods p ON c.id = p.contract_id';
    joinPeriods = true;
    if (periodDueStart) {
      params.push(periodDueStart);
      wheres.push(`p.due_date >= $${params.length}`);
    }
    if (periodDueEnd) {
      params.push(periodDueEnd);
      wheres.push(`p.due_date <= $${params.length}`);
    }
  }
  if (contractNo) {
    params.push(`%${contractNo}%`);
    wheres.push(`c.contract_no ILIKE $${params.length}`);
  }
  if (contractDate) {
    params.push(contractDate);
    wheres.push(`c.contract_date = $${params.length}`);
  }
  if (contactName) {
    params.push(`%${contactName}%`);
    wheres.push(`c.contact_name ILIKE $${params.length}`);
  }
  if (department) {
    params.push(department);
    wheres.push(`c.department = $${params.length}`);
  }
  if (startDate) {
    params.push(startDate);
    wheres.push(`c.start_date >= $${params.length}`);
  }
  if (endDate) {
    params.push(endDate);
    wheres.push(`c.end_date <= $${params.length}`);
  }
  if (periodCount) {
    params.push(periodCount);
    wheres.push(`c.period_count = $${params.length}`);
  }
  if (wheres.length > 0) {
    sql += ' WHERE ' + wheres.join(' AND ');
  }
  sql += ' ORDER BY c.id DESC';
  try {
    const result = await db.query(sql, params);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}; 