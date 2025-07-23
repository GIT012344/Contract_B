const db = require('../db');
const logService = require('../services/logService');
const emailService = require('../services/emailService');
const { DateTime } = require('luxon');

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
  const { periodNo, dueDate, alert_days } = req.body;
  if (!contractId || !periodNo || !dueDate) {
    return res.status(400).json({ error: 'contractId, periodNo, and dueDate are required' });
  }
  try {
    const result = await db.query(
      'INSERT INTO contract_periods (contract_id, period_no, due_date, alert_days) VALUES ($1, $2, $3, $4) RETURNING *',
      [contractId, periodNo, dueDate, alert_days || 0]
    );
    logService.log('PERIOD_ADD', contractId, req.user.username, { periodNo, dueDate, alert_days });

    // --- ส่งอีเมลแจ้งเตือนทันที ถ้า dueDate ใกล้กว่าหรือเท่ากับ alert_days ---
    const period = result.rows[0];
    const contractQ = await db.query('SELECT contract_no, contact_name, department, alert_emails, contact_name AS contact_person FROM contracts WHERE id = $1', [contractId]);
    const contract = contractQ.rows[0];
    if (contract && contract.alert_emails) {
      // คำนวณ daysLeft
      const today = DateTime.now().setZone('Asia/Bangkok').startOf('day');
      let dt = DateTime.fromISO(period.due_date, { zone: 'Asia/Bangkok' });
      if (!dt.isValid) {
        dt = DateTime.fromFormat(period.due_date, 'yyyy-MM-dd', { zone: 'Asia/Bangkok' });
      }
      let daysLeft = '-';
      if (dt.isValid) {
        daysLeft = Math.max(0, Math.round(dt.diff(today, 'days').days));
      }
      // เงื่อนไข: ถ้า daysLeft <= alert_days และ daysLeft >= 0 ให้ส่งอีเมลทันที
      if (typeof period.alert_days === 'number' ? (daysLeft <= period.alert_days && daysLeft >= 0) : true) {
        const dueDateThai = dt.isValid ? dt.toFormat('dd/MM/yyyy') : '-';
        const html = `
          <h2 style="color:#2d6cdf;">แจ้งเตือนงวดงานใกล้ถึงกำหนด</h2>
          <table border="1" cellpadding="8" cellspacing="0" style="border-collapse:collapse;font-size:16px;">
            <thead style="background:#f0f4fa;">
              <tr>
                <th>เลขที่สัญญา</th>
                <th>ชื่อสัญญา</th>
                <th>งวดที่</th>
                <th>วันครบกำหนด</th>
                <th>แจ้งล่วงหน้า</th>
                <th>หน่วยงาน</th>
                <th>ชื่อผู้ติดต่อ</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>${contract.contract_no}</td>
                <td>${contract.contact_name || '-'}</td>
                <td>${period.period_no}</td>
                <td>${dueDateThai}</td>
                <td>${period.alert_days} วัน</td>
                <td>${contract.department || '-'}</td>
                <td>${contract.contact_person || '-'}</td>
              </tr>
            </tbody>
          </table>
          <p style="color:#888;font-size:13px;">ระบบแจ้งเตือนอัตโนมัติ กรุณาอย่าตอบกลับอีเมลนี้</p>
        `;
        const allEmails = contract.alert_emails.split(',').map(e => e.trim()).filter(Boolean);
        try {
          await emailService.sendMail({
            to: allEmails.join(','),
            subject: `[Alert] งวดงานใกล้ถึงกำหนด (เลขที่สัญญา ${contract.contract_no})`,
            html,
          });
        } catch (err) {
          console.error('ERROR sending period alert email (addPeriod):', err);
        }
      }
    }
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('ERROR in addPeriod:', err);
    res.status(500).json({ error: err.message });
  }
};

exports.updatePeriod = async (req, res) => {
  const id = req.params.id;
  const { periodNo, dueDate, alert_days } = req.body;
  try {
    const result = await db.query(
      'UPDATE contract_periods SET period_no = $1, due_date = $2, alert_days = $3 WHERE id = $4 RETURNING *',
      [periodNo, dueDate, alert_days || 0, id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    logService.log('PERIOD_UPDATE', id, req.user.username, { periodNo, dueDate, alert_days });
    res.json(result.rows[0]);
  } catch (err) {
    console.error('ERROR in updatePeriod:', err);
    res.status(500).json({ error: err.message });
  }
};

exports.deletePeriod = async (req, res) => {
  const id = req.params.id;
  try {
    // ตรวจสอบว่ามี period นี้จริงไหม
    const check = await db.query('SELECT * FROM contract_periods WHERE id = $1', [id]);
    if (check.rows.length === 0) {
      console.error('DELETE PERIOD: Not found id', id);
      return res.status(404).json({ error: 'Not found' });
    }
    const result = await db.query('DELETE FROM contract_periods WHERE id = $1 RETURNING *', [id]);
    logService.log('PERIOD_DELETE', id, req.user.username, {});
    res.json({ success: true });
  } catch (err) {
    console.error('ERROR in deletePeriod:', err);
    res.status(500).json({ error: err.message });
  }
}; 