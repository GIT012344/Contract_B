// ทดสอบระบบแจ้งเตือนงวดงาน
require('dotenv').config();
const { Pool } = require('pg');
const nodemailer = require('nodemailer');
const { DateTime } = require('luxon');

// Database config
const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT) || 5432,
  database: process.env.DB_NAME || 'contract_db',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || '1234'
});

console.log('DB Config:', {
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT) || 5432,
  database: process.env.DB_NAME || 'contract_db',
  user: process.env.DB_USER || 'postgres'
});

// Email transporter
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: 'moonlightvilip@gmail.com',
    pass: 'lwnj edbh cnby uvuq'
  },
  tls: {
    rejectUnauthorized: false
  }
});

async function testPeriodAlerts() {
  console.log('\n========================================');
  console.log('🔔 ทดสอบระบบแจ้งเตือนงวดงาน');
  console.log('เวลา:', DateTime.now().setZone('Asia/Bangkok').toFormat('dd/MM/yyyy HH:mm:ss'));
  console.log('========================================\n');

  try {
    // 1. ตรวจสอบงวดงานที่ใกล้ถึงกำหนด
    console.log('📋 ค้นหางวดงานที่ต้องแจ้งเตือน...');
    
    // Query แบบเดียวกับใน alertJob.js แต่แสดงข้อมูลมากขึ้น
    const query = `
      SELECT c.id as contract_id, c.contract_no, c.contact_name, 
             c.status as contract_status, c.alert_emails, c.department, c.contact_person,
             p.id as period_id, p.period_no, 
             TO_CHAR(p.due_date, 'YYYY-MM-DD') as due_date,
             p.alert_days, p.status as period_status,
             (p.due_date::date - CURRENT_DATE) as days_until_due
      FROM contracts c
      JOIN contract_periods p ON c.id = p.contract_id
      WHERE c.deleted_flag = FALSE
        AND p.due_date IS NOT NULL
        AND p.due_date >= CURRENT_DATE
      ORDER BY days_until_due ASC, c.contract_no, p.period_no
    `;
    
    const result = await pool.query(query);
    console.log(`พบทั้งหมด ${result.rows.length} งวดงาน`);
    
    if (result.rows.length > 0) {
      console.log('\n📊 รายละเอียดงวดงาน:');
      console.log('=====================================');
      
      const alertPeriods = [];
      
      for (const period of result.rows) {
        const dueDate = DateTime.fromISO(period.due_date);
        const daysUntilDue = period.days_until_due;
        const alertDays = period.alert_days || 7; // default 7 วันถ้าไม่ได้ตั้งค่า
        
        console.log(`\n📌 สัญญา: ${period.contract_no} - ${period.contact_name || 'ไม่มีชื่อ'}`);
        console.log(`   สถานะสัญญา: ${period.contract_status}`);
        console.log(`   งวดที่: ${period.period_no}`);
        console.log(`   วันครบกำหนด: ${dueDate.toFormat('dd/MM/yyyy')}`);
        console.log(`   เหลือ: ${daysUntilDue} วัน`);
        console.log(`   แจ้งล่วงหน้า: ${alertDays} วัน`);
        console.log(`   สถานะงวด: ${period.period_status || 'ไม่มี'}`);
        console.log(`   อีเมลแจ้งเตือน: ${period.alert_emails || 'ไม่มี'}`);
        
        // ตรวจสอบเงื่อนไขการแจ้งเตือน
        const shouldAlert = period.contract_status === 'ACTIVE' && 
                          daysUntilDue <= alertDays && 
                          period.alert_emails && 
                          period.alert_emails.trim();
        
        if (shouldAlert) {
          console.log(`   ✅ ควรแจ้งเตือน: ใช่`);
          alertPeriods.push(period);
        } else {
          console.log(`   ❌ ควรแจ้งเตือน: ไม่`);
          if (period.contract_status !== 'ACTIVE') {
            console.log(`      - สัญญาไม่ใช่สถานะ ACTIVE`);
          }
          if (daysUntilDue > alertDays) {
            console.log(`      - ยังไม่ถึงเวลาแจ้งเตือน (${daysUntilDue} > ${alertDays})`);
          }
          if (!period.alert_emails || !period.alert_emails.trim()) {
            console.log(`      - ไม่มีอีเมลแจ้งเตือน`);
          }
        }
      }
      
      // ส่งอีเมลแจ้งเตือน
      if (alertPeriods.length > 0) {
        console.log('\n========================================');
        console.log(`📧 พบ ${alertPeriods.length} งวดงานที่ต้องแจ้งเตือน`);
        console.log('========================================\n');
        
        // จัดกลุ่มตามสัญญา
        const contractGroups = {};
        alertPeriods.forEach(p => {
          if (!contractGroups[p.contract_no]) {
            contractGroups[p.contract_no] = {
              contract_no: p.contract_no,
              contact_name: p.contact_name,
              department: p.department,
              alert_emails: p.alert_emails,
              periods: []
            };
          }
          contractGroups[p.contract_no].periods.push(p);
        });
        
        for (const contractNo in contractGroups) {
          const contract = contractGroups[contractNo];
          const emails = contract.alert_emails.split(',').map(e => e.trim()).filter(Boolean);
          
          console.log(`\n📨 กำลังส่งแจ้งเตือนสัญญา: ${contractNo}`);
          console.log(`   ถึง: ${emails.join(', ')}`);
          console.log(`   จำนวนงวด: ${contract.periods.length} งวด`);
          
          // สร้าง HTML สำหรับอีเมล
          const periodRows = contract.periods.map(p => {
            const dueDate = DateTime.fromISO(p.due_date);
            return `
              <tr>
                <td style="padding: 8px; border: 1px solid #ddd;">${p.period_no}</td>
                <td style="padding: 8px; border: 1px solid #ddd;">${dueDate.toFormat('dd/MM/yyyy')}</td>
                <td style="padding: 8px; border: 1px solid #ddd;">${p.days_until_due} วัน</td>
                <td style="padding: 8px; border: 1px solid #ddd;">${p.period_status || 'รอดำเนินการ'}</td>
              </tr>
            `;
          }).join('');
          
          const html = `
            <!DOCTYPE html>
            <html>
            <head>
              <meta charset="UTF-8">
              <style>
                body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; }
                .container { max-width: 700px; margin: 0 auto; padding: 20px; }
                .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; border-radius: 10px 10px 0 0; }
                .content { background: #f8f9fa; padding: 30px; border-radius: 0 0 10px 10px; }
                .alert-box { background: white; padding: 20px; border-left: 4px solid #ffc107; margin: 20px 0; border-radius: 5px; }
                table { width: 100%; border-collapse: collapse; margin: 20px 0; }
                th { background: #6c757d; color: white; padding: 10px; text-align: left; }
                .footer { text-align: center; color: #6c757d; font-size: 12px; margin-top: 30px; padding-top: 20px; border-top: 1px solid #dee2e6; }
              </style>
            </head>
            <body>
              <div class="container">
                <div class="header">
                  <h1 style="margin: 0; font-size: 24px;">📅 แจ้งเตือนงวดงานใกล้ถึงกำหนด</h1>
                  <p style="margin: 10px 0 0 0; opacity: 0.9;">Contract Period Alert</p>
                </div>
                <div class="content">
                  <div class="alert-box">
                    <h2 style="margin: 0 0 10px 0; color: #856404;">งวดงานที่ต้องติดตาม</h2>
                    <p><strong>เลขที่สัญญา:</strong> ${contract.contract_no}</p>
                    <p><strong>ชื่อสัญญา:</strong> ${contract.contact_name || '-'}</p>
                    <p><strong>หน่วยงาน:</strong> ${contract.department || '-'}</p>
                  </div>
                  
                  <h3>รายละเอียดงวดงาน:</h3>
                  <table>
                    <thead>
                      <tr>
                        <th>งวดที่</th>
                        <th>วันครบกำหนด</th>
                        <th>เหลือเวลา</th>
                        <th>สถานะ</th>
                      </tr>
                    </thead>
                    <tbody>
                      ${periodRows}
                    </tbody>
                  </table>
                  
                  <div style="background: #fff3cd; padding: 15px; border-radius: 5px; margin-top: 20px;">
                    <p style="margin: 0; color: #856404;">
                      <strong>📌 หมายเหตุ:</strong> กรุณาติดตามและดำเนินการตามงวดงานที่กำหนด
                    </p>
                  </div>
                  
                  <div class="footer">
                    <p>อีเมลนี้ส่งจากระบบจัดการสัญญาอัตโนมัติ</p>
                    <p>Contract Management System - Period Alert</p>
                    <p>${DateTime.now().setZone('Asia/Bangkok').toFormat('dd/MM/yyyy HH:mm:ss')}</p>
                  </div>
                </div>
              </div>
            </body>
            </html>
          `;
          
          try {
            const info = await transporter.sendMail({
              from: 'Contract Alert System <moonlightvilip@gmail.com>',
              to: emails.join(', '),
              subject: `📅 แจ้งเตือนงวดงานใกล้ถึงกำหนด - สัญญา ${contractNo}`,
              html: html
            });
            
            console.log(`   ✅ ส่งอีเมลสำเร็จ! Message ID: ${info.messageId}`);
            
            // บันทึก log
            await pool.query(
              `INSERT INTO user_activity_logs (user_id, action, details, ip_address) 
               VALUES ($1, $2, $3, $4)`,
              ['system', 'ALERT_PERIOD_SENT', 
               `Sent period alert for contract ${contractNo} (${contract.periods.length} periods)`,
               '127.0.0.1']
            );
            
          } catch (emailError) {
            console.error(`   ❌ ส่งอีเมลล้มเหลว:`, emailError.message);
          }
        }
      } else {
        console.log('\n✅ ไม่มีงวดงานที่ต้องแจ้งเตือนในขณะนี้');
      }
    } else {
      console.log('\n✅ ไม่มีงวดงานในระบบ');
    }
    
    console.log('\n========================================');
    console.log('✅ ทดสอบเสร็จสิ้น');
    console.log('========================================\n');
    
  } catch (error) {
    console.error('\n❌ เกิดข้อผิดพลาด:', error.message);
    console.error(error);
  } finally {
    await pool.end();
  }
}

// รันทันที
testPeriodAlerts();
