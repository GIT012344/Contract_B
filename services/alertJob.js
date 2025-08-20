const config = require('../config/config');
const emailService = require('./emailService');
const db = require('../db');
const logService = require('./logService');
const { DateTime } = require('luxon');

async function runAlertJob() {
  const today = DateTime.now().setZone('Asia/Bangkok').startOf('day');
  // --- เปลี่ยนสถานะ CRTD -> ACTIVE ---
  await db.query(
    `UPDATE contracts SET status = 'ACTIVE', updated_at = CURRENT_TIMESTAMP
     WHERE status = 'CRTD' AND start_date IS NOT NULL AND start_date <= CURRENT_DATE AND deleted_flag = FALSE`
  );
  // --- เปลี่ยนสถานะ ACTIVE -> EXPIRE ---
  await db.query(
    `UPDATE contracts SET status = 'EXPIRE', updated_at = CURRENT_TIMESTAMP
     WHERE status = 'ACTIVE' AND end_date IS NOT NULL AND end_date <= CURRENT_DATE AND deleted_flag = FALSE`
  );

  // --- แจ้งเตือนงวดงาน (แยกตามสัญญา/อีเมล) ---
  const duePeriods = await db.query(
    `SELECT c.contract_no, c.contact_name, c.department, c.alert_emails, c.contact_name AS contact_person, p.period_no, p.due_date, p.alert_days
     FROM contracts c
     JOIN contract_periods p ON c.id = p.contract_id
     WHERE c.status = 'ACTIVE' AND c.deleted_flag = FALSE
       AND p.due_date IS NOT NULL
       AND p.due_date >= CURRENT_DATE
       AND (p.due_date::date - CURRENT_DATE) = COALESCE(p.alert_days, 0)`
  );
  // group by contract_no + alert_emails
  const periodGroups = {};
  duePeriods.rows.forEach(d => {
    const key = `${d.contract_no}|${d.alert_emails}|${d.contact_name || ''}|${d.department || ''}|${d.contact_person || ''}`;
    if (!periodGroups[key]) periodGroups[key] = [];
    periodGroups[key].push(d);
  });
  for (const key in periodGroups) {
    const [contractNo, alertEmails, contractName, department, contactPerson] = key.split('|');
    const periods = periodGroups[key];
    const htmlRows = periods.map(d => {
      let dueDateThai = '-';
      if (d.due_date) {
        let dt;
        if (typeof d.due_date === 'string') {
          dt = DateTime.fromISO(d.due_date, { zone: 'Asia/Bangkok' });
        } else if (d.due_date instanceof Date) {
          dt = DateTime.fromJSDate(d.due_date, { zone: 'Asia/Bangkok' });
        }
        if (dt && dt.isValid) {
          dueDateThai = dt.toFormat('dd/MM/yyyy');
        }
      }
      return `<tr>
        <td>${d.contract_no}</td>
        <td>${d.contact_name || '-'}</td>
        <td>${d.period_no}</td>
        <td>${dueDateThai}</td>
        <td>${d.alert_days} วัน</td>
        <td>${d.department || '-'}</td>
        <td>${d.contact_person || '-'}</td>
      </tr>`;
    }).join('');
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
          ${htmlRows}
        </tbody>
      </table>
      <p style="color:#888;font-size:13px;">ระบบแจ้งเตือนอัตโนมัติ กรุณาอย่าตอบกลับอีเมลนี้</p>
    `;
    const allEmails = alertEmails.split(',').map(e => e.trim()).filter(Boolean);
    try {
      await emailService.sendMail({
        to: allEmails.join(','),
        subject: `[Alert] งวดงานใกล้ถึงกำหนด (เลขที่สัญญา ${contractNo})`,
        html,
      });
      logService.log('ALERT_PERIOD_DUE', contractNo, 'system', { count: periods.length });
      console.log('Alert email sent for due periods to:', allEmails, 'contract:', contractNo);
    } catch (err) {
      console.error('ERROR sending alert email:', err);
    }
  }

  // --- แจ้งเตือนสัญญาใกล้หมดอายุ (แยกตามสัญญา/อีเมล) ---
  const expiring = await db.query(
    `SELECT contract_no, contact_name, department, alert_emails, contact_name AS contact_person, end_date
     FROM contracts
     WHERE status = 'ACTIVE' AND deleted_flag = FALSE AND end_date IS NOT NULL
       AND (end_date::date - CURRENT_DATE) <= $1 AND (end_date::date - CURRENT_DATE) >= 0`,
    [config.ALERT_CONTRACT_EXPIRY_DAYS]
  );
  for (const c of expiring.rows) {
    let endDateThai = '-';
    if (c.end_date) {
      let dt;
      if (typeof c.end_date === 'string') {
        dt = DateTime.fromISO(c.end_date, { zone: 'Asia/Bangkok' });
        if (!dt.isValid) {
          dt = DateTime.fromFormat(c.end_date, 'yyyy-MM-dd', { zone: 'Asia/Bangkok' });
        }
      } else if (c.end_date instanceof Date) {
        dt = DateTime.fromJSDate(c.end_date, { zone: 'Asia/Bangkok' });
      }
      if (dt && dt.isValid) {
        endDateThai = dt.toFormat('dd/MM/yyyy');
      } else {
        console.log('DEBUG end_date:', c.end_date, 'typeof:', typeof c.end_date, 'dt:', dt ? dt.toISODate() : null, 'isValid:', dt ? dt.isValid : null);
      }
    }
    let daysLeft = '-';
    if (c.end_date) {
      let dt;
      if (typeof c.end_date === 'string') {
        dt = DateTime.fromISO(c.end_date, { zone: 'Asia/Bangkok' });
        if (!dt.isValid) {
          dt = DateTime.fromFormat(c.end_date, 'yyyy-MM-dd', { zone: 'Asia/Bangkok' });
        }
      } else if (c.end_date instanceof Date) {
        dt = DateTime.fromJSDate(c.end_date, { zone: 'Asia/Bangkok' });
      }
      if (dt && dt.isValid) {
        daysLeft = Math.max(0, Math.round(dt.diff(today, 'days').days));
      } else {
        console.log('DEBUG end_date:', c.end_date, 'typeof:', typeof c.end_date, 'dt:', dt ? dt.toISODate() : null, 'isValid:', dt ? dt.isValid : null);
      }
    }
    const html = `
      <h2 style="color:#d9534f;">แจ้งเตือนสัญญาใกล้หมดอายุ</h2>
      <table border="1" cellpadding="8" cellspacing="0" style="border-collapse:collapse;font-size:16px;">
        <thead style="background:#fbeee0;">
          <tr>
            <th>เลขที่สัญญา</th>
            <th>ชื่อสัญญา</th>
            <th>วันสิ้นสุดสัญญา</th>
            <th>เหลืออีก (วัน)</th>
            <th>หน่วยงาน</th>
            <th>ชื่อผู้ติดต่อ</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>${c.contract_no}</td>
            <td>${c.contact_name || '-'}</td>
            <td>${endDateThai}</td>
            <td>${daysLeft}</td>
            <td>${c.department || '-'}</td>
            <td>${c.contact_person || '-'}</td>
          </tr>
        </tbody>
      </table>
      <p style="color:#888;font-size:13px;">ระบบแจ้งเตือนอัตโนมัติ กรุณาอย่าตอบกลับอีเมลนี้</p>
    `;
    const allEmails = c.alert_emails ? c.alert_emails.split(',').map(e => e.trim()).filter(Boolean) : [];
    try {
      await emailService.sendMail({
        to: allEmails.join(','),
        subject: `[Alert] สัญญาใกล้หมดอายุ (เลขที่สัญญา ${c.contract_no})`,
        html,
      });
      logService.log('ALERT_CONTRACT_EXPIRY', c.contract_no, 'system', { daysLeft });
      console.log('Alert email sent for expiring contract to:', allEmails, 'contract:', c.contract_no);
    } catch (err) {
      console.error('ERROR sending contract expiry email:', err);
    }
  }
}

module.exports = { runAlertJob }; 