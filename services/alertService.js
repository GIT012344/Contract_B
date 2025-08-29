const db = require('../db');
const nodemailer = require('nodemailer');

// Email configuration with safe defaults
const emailConfig = {
  host: process.env.EMAIL_HOST || 'smtp.gmail.com',
  port: process.env.EMAIL_PORT || 587,
  user: process.env.EMAIL_USER || '',
  password: process.env.EMAIL_PASSWORD || '',
  from: process.env.EMAIL_FROM || process.env.EMAIL_USER || 'noreply@company.com'
};

// สร้าง transporter สำหรับส่งอีเมล
let transporter = null;
if (emailConfig.user && emailConfig.password) {
  transporter = nodemailer.createTransport({
    host: emailConfig.host,
    port: emailConfig.port,
    secure: false,
    auth: {
      user: emailConfig.user,
      pass: emailConfig.password
    }
  });
}

// ตรวจสอบสัญญาที่ใกล้หมดอายุ
exports.checkExpiringContracts = async (daysBeforeExpiry = 7) => {
  try {
    const query = `
      SELECT 
        c.*,
        (c.end_date - CURRENT_DATE) as days_remaining
      FROM contracts c
      WHERE c.deleted_flag = FALSE 
        AND c.status IN ('ACTIVE', 'CRTD')
        AND c.end_date IS NOT NULL
        AND (c.end_date - CURRENT_DATE) BETWEEN 0 AND $1
      ORDER BY c.end_date ASC
    `;
    
    const result = await db.query(query, [daysBeforeExpiry]);
    return result.rows;
  } catch (error) {
    console.error('Error checking expiring contracts:', error);
    throw error;
  }
};

// ตรวจสอบงวดงานที่ใกล้ถึงกำหนด
exports.checkUpcomingPeriods = async () => {
  try {
    const query = `
      SELECT 
        p.*,
        c.contract_no,
        c.contact_name,
        c.alert_emails,
        (p.due_date - CURRENT_DATE) as days_remaining
      FROM contract_periods p
      JOIN contracts c ON p.contract_id = c.id
      WHERE c.deleted_flag = FALSE 
        AND p.status != 'เสร็จสิ้น'
        AND p.due_date IS NOT NULL
        AND (p.due_date - CURRENT_DATE) <= p.alert_days
        AND (p.due_date - CURRENT_DATE) >= 0
      ORDER BY p.due_date ASC
    `;
    
    const result = await db.query(query);
    return result.rows;
  } catch (error) {
    console.error('Error checking upcoming periods:', error);
    throw error;
  }
};

// Check if alert was already sent today
const wasAlertSentToday = async (alertType, itemId, email) => {
  try {
    const result = await db.query(
      `SELECT id FROM alert_tracking 
       WHERE alert_type = $1 
       AND item_id = $2 
       AND email_address = $3 
       AND sent_date = CURRENT_DATE`,
      [alertType, itemId, email]
    );
    return result.rows.length > 0;
  } catch (error) {
    console.error('Error checking alert tracking:', error);
    return false;
  }
};

// Record that alert was sent
const recordAlertSent = async (alertType, itemId, email) => {
  try {
    await db.query(
      `INSERT INTO alert_tracking (alert_type, item_id, email_address) 
       VALUES ($1, $2, $3) 
       ON CONFLICT (alert_type, item_id, email_address, sent_date) 
       DO NOTHING`,
      [alertType, itemId, email]
    );
  } catch (error) {
    console.error('Error recording alert sent:', error);
  }
};

// ส่งอีเมลแจ้งเตือน
exports.sendAlertEmail = async (to, subject, htmlContent) => {
  try {
    // ถ้าไม่มีการตั้งค่าอีเมล ให้ log แทน
    if (!emailConfig.user || !emailConfig.password || !transporter) {
      console.log('Email alert (not sent - no email config):');
      console.log('To:', to);
      console.log('Subject:', subject);
      console.log('Content:', htmlContent);
      return { success: true, message: 'Email logged (no config)' };
    }

    const mailOptions = {
      from: emailConfig.from,
      to: to,
      subject: subject,
      html: htmlContent
    };

    const info = await transporter.sendMail(mailOptions);
    console.log('Email sent:', info.messageId);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error('Error sending email:', error);
    return { success: false, error: error.message };
  }
};

// สร้าง HTML สำหรับอีเมลแจ้งเตือนสัญญา
exports.generateContractAlertHTML = (contracts) => {
  let html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #2563eb;">แจ้งเตือนสัญญาใกล้หมดอายุ</h2>
      <p>มีสัญญาที่ใกล้หมดอายุต้องดำเนินการ:</p>
      <table style="width: 100%; border-collapse: collapse;">
        <thead>
          <tr style="background-color: #f3f4f6;">
            <th style="padding: 8px; border: 1px solid #d1d5db;">เลขที่สัญญา</th>
            <th style="padding: 8px; border: 1px solid #d1d5db;">ชื่อสัญญา</th>
            <th style="padding: 8px; border: 1px solid #d1d5db;">วันหมดอายุ</th>
            <th style="padding: 8px; border: 1px solid #d1d5db;">เหลือเวลา</th>
          </tr>
        </thead>
        <tbody>
  `;

  contracts.forEach(contract => {
    const daysRemaining = Math.floor(contract.days_remaining);
    const urgency = daysRemaining <= 3 ? 'color: #ef4444; font-weight: bold;' : 
                    daysRemaining <= 7 ? 'color: #f59e0b;' : '';
    
    html += `
      <tr>
        <td style="padding: 8px; border: 1px solid #d1d5db;">${contract.contract_no}</td>
        <td style="padding: 8px; border: 1px solid #d1d5db;">${contract.contact_name || '-'}</td>
        <td style="padding: 8px; border: 1px solid #d1d5db;">${new Date(contract.end_date).toLocaleDateString('th-TH')}</td>
        <td style="padding: 8px; border: 1px solid #d1d5db; ${urgency}">${daysRemaining} วัน</td>
      </tr>
    `;
  });

  html += `
        </tbody>
      </table>
      <p style="margin-top: 20px; color: #6b7280;">
        กรุณาดำเนินการต่ออายุหรือปิดสัญญาตามความเหมาะสม
      </p>
    </div>
  `;

  return html;
};

// สร้าง HTML สำหรับอีเมลแจ้งเตือนงวดงาน
exports.generatePeriodAlertHTML = (periods) => {
  let html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #2563eb;">แจ้งเตือนงวดงานใกล้ถึงกำหนด</h2>
      <p>มีงวดงานที่ใกล้ถึงกำหนดส่งมอบ:</p>
      <table style="width: 100%; border-collapse: collapse;">
        <thead>
          <tr style="background-color: #f3f4f6;">
            <th style="padding: 8px; border: 1px solid #d1d5db;">เลขที่สัญญา</th>
            <th style="padding: 8px; border: 1px solid #d1d5db;">งวดที่</th>
            <th style="padding: 8px; border: 1px solid #d1d5db;">วันที่กำหนดส่ง</th>
            <th style="padding: 8px; border: 1px solid #d1d5db;">เหลือเวลา</th>
          </tr>
        </thead>
        <tbody>
  `;

  periods.forEach(period => {
    const daysRemaining = Math.floor(period.days_remaining);
    const urgency = daysRemaining <= 1 ? 'color: #ef4444; font-weight: bold;' : 
                    daysRemaining <= 3 ? 'color: #f59e0b;' : '';
    
    html += `
      <tr>
        <td style="padding: 8px; border: 1px solid #d1d5db;">${period.contract_no}</td>
        <td style="padding: 8px; border: 1px solid #d1d5db;">${period.period_no}</td>
        <td style="padding: 8px; border: 1px solid #d1d5db;">${new Date(period.due_date).toLocaleDateString('th-TH')}</td>
        <td style="padding: 8px; border: 1px solid #d1d5db; ${urgency}">${daysRemaining} วัน</td>
      </tr>
    `;
  });

  html += `
        </tbody>
      </table>
      <p style="margin-top: 20px; color: #6b7280;">
        กรุณาเตรียมเอกสารและดำเนินการส่งมอบงานตามกำหนด
      </p>
    </div>
  `;

  return html;
};

// ฟังก์ชันหลักสำหรับรันการแจ้งเตือนทั้งหมด
exports.runDailyAlerts = async () => {
  console.log('Starting daily alert check...', new Date().toISOString());
  
  try {
    // 1. ตรวจสอบสัญญาที่ใกล้หมดอายุ (default 7 วัน)
    const expiringContracts = await exports.checkExpiringContracts(7);
    
    if (expiringContracts.length > 0) {
      console.log(`Found ${expiringContracts.length} expiring contracts`);
      
      // จัดกลุ่มตาม alert_emails และกรองเฉพาะที่ยังไม่ได้ส่งวันนี้
      const emailGroups = {};
      for (const contract of expiringContracts) {
        if (contract.alert_emails) {
          const emails = contract.alert_emails.split(',').map(e => e.trim()).filter(e => e);
          for (const email of emails) {
            // Check if alert was already sent today for this contract
            const alreadySent = await wasAlertSentToday('CONTRACT_EXPIRY', contract.id, email);
            if (!alreadySent) {
              if (!emailGroups[email]) {
                emailGroups[email] = { contracts: [], contractIds: [] };
              }
              emailGroups[email].contracts.push(contract);
              emailGroups[email].contractIds.push(contract.id);
            } else {
              console.log(`Alert already sent today for contract ${contract.contract_no} to ${email}`);
            }
          }
        }
      }
      
      // ส่งอีเมลแต่ละกลุ่ม
      for (const [email, data] of Object.entries(emailGroups)) {
        if (data.contracts.length > 0) {
          const html = exports.generateContractAlertHTML(data.contracts);
          const result = await exports.sendAlertEmail(
            email,
            'แจ้งเตือน: สัญญาใกล้หมดอายุ',
            html
          );
          
          // Record that alerts were sent
          if (result.success) {
            for (const contractId of data.contractIds) {
              await recordAlertSent('CONTRACT_EXPIRY', contractId, email);
            }
          }
        }
      }
    }
    
    // 2. ตรวจสอบงวดงานที่ใกล้ถึงกำหนด
    const upcomingPeriods = await exports.checkUpcomingPeriods();
    
    if (upcomingPeriods.length > 0) {
      console.log(`Found ${upcomingPeriods.length} upcoming periods`);
      
      // จัดกลุ่มตาม alert_emails และกรองเฉพาะที่ยังไม่ได้ส่งวันนี้
      const emailGroups = {};
      for (const period of upcomingPeriods) {
        if (period.alert_emails) {
          const emails = period.alert_emails.split(',').map(e => e.trim()).filter(e => e);
          for (const email of emails) {
            // Check if alert was already sent today for this period
            const alreadySent = await wasAlertSentToday('PERIOD_DUE', period.id, email);
            if (!alreadySent) {
              if (!emailGroups[email]) {
                emailGroups[email] = { periods: [], periodIds: [] };
              }
              emailGroups[email].periods.push(period);
              emailGroups[email].periodIds.push(period.id);
            } else {
              console.log(`Alert already sent today for period ${period.period_no} (contract ${period.contract_no}) to ${email}`);
            }
          }
        }
      }
      
      // ส่งอีเมลแต่ละกลุ่ม
      for (const [email, data] of Object.entries(emailGroups)) {
        if (data.periods.length > 0) {
          const html = exports.generatePeriodAlertHTML(data.periods);
          const result = await exports.sendAlertEmail(
            email,
            'แจ้งเตือน: งวดงานใกล้ถึงกำหนด',
            html
          );
          
          // Record that alerts were sent
          if (result.success) {
            for (const periodId of data.periodIds) {
              await recordAlertSent('PERIOD_DUE', periodId, email);
            }
          }
        }
      }
    }
    
    console.log('Daily alert check completed');
    return {
      success: true,
      expiringContracts: expiringContracts.length,
      upcomingPeriods: upcomingPeriods.length
    };
    
  } catch (error) {
    console.error('Error in daily alerts:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

// Clean up old tracking records (older than 30 days)
exports.cleanupOldTracking = async () => {
  try {
    const result = await db.query(
      `DELETE FROM alert_tracking 
       WHERE sent_date < CURRENT_DATE - INTERVAL '30 days'`
    );
    console.log(`Cleaned up ${result.rowCount} old tracking records`);
  } catch (error) {
    console.error('Error cleaning up tracking records:', error);
  }
};

// Alias function for compatibility with test script
exports.checkAndSendAlerts = exports.runDailyAlerts;
