const db = require('../db');
const logService = require('../services/logService');
const emailService = require('../services/emailService');
const { DateTime } = require('luxon');
const ActivityLogger = require('../services/activityLogger');

// ดึงข้อมูลงวดงานทั้งหมดสำหรับการแจ้งเตือน
exports.getAllPeriods = async (req, res) => {
  try {
    const query = `
      SELECT 
        cp.id,
        cp.period_no,
        cp.due_date,
        cp.alert_days,
        c.id as contract_id,
        c.contract_no,
        c.contact_name,
        c.department
      FROM contract_periods cp
      JOIN contracts c ON cp.contract_id = c.id
      WHERE c.deleted_flag = FALSE
      ORDER BY cp.due_date ASC
    `;
    
    const result = await db.query(query);
    
    // คำนวณ days left สำหรับแต่ละงวด
    const today = DateTime.now().setZone('Asia/Bangkok').startOf('day');
    const periodsWithDaysLeft = result.rows.map(period => {
      let daysLeft = '-';
      
      if (period.due_date) {
        let dt = null;
        
        if (typeof period.due_date === 'string') {
          dt = DateTime.fromISO(period.due_date, { zone: 'Asia/Bangkok' });
          if (!dt.isValid) {
            dt = DateTime.fromFormat(period.due_date, 'yyyy-MM-dd', { zone: 'Asia/Bangkok' });
          }
        } else if (period.due_date instanceof Date) {
          dt = DateTime.fromJSDate(period.due_date, { zone: 'Asia/Bangkok' });
        }
        
        if (dt && dt.isValid) {
          daysLeft = Math.round(dt.diff(today, 'days').days);
        }
      }
      
      return {
        ...period,
        daysLeft,
        isOverdue: typeof daysLeft === 'number' && daysLeft < 0,
        isUrgent: typeof daysLeft === 'number' && daysLeft >= 0 && daysLeft <= (period.alert_days || 7)
      };
    });
    
    // บันทึก Activity Log
    await ActivityLogger.log({
      userId: req.user.id,
      username: req.user.username,
      actionType: 'VIEW',
      resourceType: 'PERIOD',
      description: 'ดูรายการงวดงานทั้งหมด',
      ipAddress: ActivityLogger.getClientIP(req),
      userAgent: req.get('User-Agent'),
      requestMethod: req.method,
      requestUrl: req.originalUrl,
      statusCode: 200
    });
    
    res.json(periodsWithDaysLeft);
  } catch (err) {
    console.error('ERROR in getAllPeriods:', err);
    await ActivityLogger.logError(req.user, err, req);
    res.status(500).json({ error: err.message });
  }
};

// GET /api/contracts/:contractId/periods - ดึงงวดงานของสัญญาเฉพาะ
exports.listPeriods = async (req, res) => {
  const contractId = req.params.contractId;
  try {
    const query = `
      SELECT 
        cp.id,
        cp.contract_id,
        cp.period_no,
        cp.due_date,
        cp.alert_days,
        cp.description,
        cp.amount,
        cp.status,
        cp.created_at,
        cp.updated_at
      FROM contract_periods cp
      WHERE cp.contract_id = $1 
      ORDER BY cp.period_no ASC
    `;
    
    const result = await db.query(query, [contractId]);
    
    // แปลงข้อมูลให้ตรงตาม Frontend format
    const periods = result.rows.map(period => ({
      id: period.id,
      contract_id: period.contract_id,
      period_no: period.period_no,
      status: period.status || 'รอดำเนินการ', // default status
      due_date: period.due_date,
      description: period.description || `งวดที่ ${period.period_no}`,
      amount: period.amount || 0,
      alert_days: period.alert_days || 0,
      created_at: period.created_at,
      updated_at: period.updated_at
    }));
    
    res.json(periods);
  } catch (err) {
    console.error('Error fetching periods:', err);
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
    
    // บันทึก Activity Log สำหรับการเพิ่มงวดงาน
    await ActivityLogger.log({
      userId: req.user.id,
      username: req.user.username,
      actionType: 'CREATE',
      resourceType: 'PERIOD',
      resourceId: result.rows[0].id,
      description: `เพิ่มงวดงานที่ ${periodNo} สำหรับ Contract ID: ${contractId}`,
      ipAddress: ActivityLogger.getClientIP(req),
      userAgent: req.get('User-Agent'),
      requestMethod: req.method,
      requestUrl: req.originalUrl,
      statusCode: 201
    });

    // --- ส่งอีเมลแจ้งเตือนทันที ถ้า dueDate ใกล้กว่าหรือเท่ากับ alert_days ---
    const period = result.rows[0];
    const contractQ = await db.query('SELECT contract_no, contact_name, department, alert_emails, contact_name AS contact_person FROM contracts WHERE id = $1', [contractId]);
    const contract = contractQ.rows[0];
    if (contract && contract.alert_emails) {
      // คำนวณ daysLeft
      const today = DateTime.now().setZone('Asia/Bangkok').startOf('day');
      let dt = null;
      let daysLeft = '-';
      
      // ตรวจสอบว่า due_date มีค่าและเป็น string ก่อนใช้ Luxon
      if (period.due_date && typeof period.due_date === 'string') {
        dt = DateTime.fromISO(period.due_date, { zone: 'Asia/Bangkok' });
        if (!dt.isValid) {
          dt = DateTime.fromFormat(period.due_date, 'yyyy-MM-dd', { zone: 'Asia/Bangkok' });
        }
        
        if (dt.isValid) {
          daysLeft = Math.max(0, Math.round(dt.diff(today, 'days').days));
        }
      } else if (period.due_date && period.due_date instanceof Date) {
        // กรณีที่ due_date เป็น Date object
        dt = DateTime.fromJSDate(period.due_date, { zone: 'Asia/Bangkok' });
        if (dt.isValid) {
          daysLeft = Math.max(0, Math.round(dt.diff(today, 'days').days));
        }
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
  const { periodNo, dueDate, alert_days, status } = req.body;
  try {
    let result;
    let description;
    
    // ดึงข้อมูลเดิมก่อน
    const existing = await db.query('SELECT * FROM contract_periods WHERE id = $1', [id]);
    if (existing.rows.length === 0) {
      return res.status(404).json({ error: 'Period not found' });
    }
    const currentPeriod = existing.rows[0];
    
    // ถ้าส่งมาแค่ status อย่างเดียว (จากปุ่มทางลัด)
    if (status && !periodNo && !dueDate && alert_days === undefined) {
      result = await db.query(
        'UPDATE contract_periods SET status = $1 WHERE id = $2 RETURNING *',
        [status, id]
      );
      logService.log('PERIOD_STATUS_UPDATE', id, req.user.username, { status });
      description = `อัปเดตสถานะงวดงานเป็น ${status}`;
    } else {
      // ใช้ค่าเดิมถ้าไม่ได้ส่งมาใหม่
      const updatePeriodNo = periodNo !== undefined ? periodNo : currentPeriod.period_no;
      const updateDueDate = dueDate !== undefined ? dueDate : currentPeriod.due_date;
      const updateAlertDays = alert_days !== undefined ? alert_days : currentPeriod.alert_days;
      const updateStatus = status !== undefined ? status : currentPeriod.status;
      
      // อัปเดตข้อมูล
      result = await db.query(
        'UPDATE contract_periods SET period_no = $1, due_date = $2, alert_days = $3, status = $4 WHERE id = $5 RETURNING *',
        [updatePeriodNo, updateDueDate, updateAlertDays || 0, updateStatus || 'รอดำเนินการ', id]
      );
      logService.log('PERIOD_UPDATE', id, req.user.username, { periodNo: updatePeriodNo, dueDate: updateDueDate, alert_days: updateAlertDays, status: updateStatus });
      description = `แก้ไขงวดงานที่ ${updatePeriodNo}`;
    }
    
    // บันทึก Activity Log สำหรับการแก้ไขงวดงาน
    await ActivityLogger.log({
      userId: req.user.id,
      username: req.user.username,
      actionType: 'UPDATE',
      resourceType: 'PERIOD',
      resourceId: id,
      description: description,
      ipAddress: ActivityLogger.getClientIP(req),
      userAgent: req.get('User-Agent'),
      requestMethod: req.method,
      requestUrl: req.originalUrl,
      statusCode: 200
    });
    
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
    
    // บันทึก Activity Log สำหรับการลบงวดงาน
    await ActivityLogger.log({
      userId: req.user.id,
      username: req.user.username,
      actionType: 'DELETE',
      resourceType: 'PERIOD',
      resourceId: id,
      description: `ลบงวดงาน ID: ${id}`,
      ipAddress: ActivityLogger.getClientIP(req),
      userAgent: req.get('User-Agent'),
      requestMethod: req.method,
      requestUrl: req.originalUrl,
      statusCode: 200
    });
    
    res.json({ success: true });
  } catch (err) {
    console.error('ERROR in deletePeriod:', err);
    res.status(500).json({ error: err.message });
  }
};

// GET /api/periods - ดึงงวดงานทั้งหมด (fallback)
exports.getAllPeriodsSimple = async (req, res) => {
  try {
    const query = `
      SELECT 
        cp.id,
        cp.contract_id,
        cp.period_no,
        cp.due_date,
        cp.alert_days,
        cp.description,
        cp.amount,
        cp.status,
        cp.created_at,
        cp.updated_at,
        c.contract_no,
        c.contact_name,
        c.department
      FROM contract_periods cp
      JOIN contracts c ON cp.contract_id = c.id
      WHERE c.deleted_flag = FALSE
      ORDER BY cp.due_date ASC, cp.period_no ASC
    `;
    
    const result = await db.query(query);
    
    // แปลงข้อมูลให้ตรงตาม Frontend format
    const periods = result.rows.map(period => ({
      id: period.id,
      contract_id: period.contract_id,
      period_no: period.period_no,
      status: period.status || 'รอดำเนินการ',
      due_date: period.due_date,
      description: period.description || `งวดที่ ${period.period_no}`,
      amount: period.amount || 0,
      alert_days: period.alert_days || 0,
      // ข้อมูลสัญญาเพิ่มเติม
      contract_no: period.contract_no,
      contact_name: period.contact_name,
      department: period.department,
      created_at: period.created_at,
      updated_at: period.updated_at
    }));
    
    res.json(periods);
  } catch (err) {
    console.error('Error fetching all periods:', err);
    res.status(500).json({ error: err.message });
  }
};