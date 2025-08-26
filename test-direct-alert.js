// ทดสอบระบบแจ้งเตือนโดยตรง
const { Pool } = require('pg');
const nodemailer = require('nodemailer');
const { DateTime } = require('luxon');

// Database config
const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'contract_db',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || '1234'
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

async function checkAndSendAlerts() {
  console.log('\n========================================');
  console.log('🔔 ระบบแจ้งเตือนสัญญา - ทดสอบการทำงาน');
  console.log('เวลา:', DateTime.now().setZone('Asia/Bangkok').toFormat('dd/MM/yyyy HH:mm:ss'));
  console.log('========================================\n');

  try {
    // 1. ตรวจสอบการเชื่อมต่อ database
    console.log('📊 ตรวจสอบ Database...');
    const dbTest = await pool.query('SELECT NOW()');
    console.log('✅ Database เชื่อมต่อสำเร็จ');
    
    // 2. ตรวจสอบการเชื่อมต่อ email
    console.log('\n📧 ตรวจสอบ Email Service...');
    await transporter.verify();
    console.log('✅ Email service พร้อมใช้งาน');
    
    // 3. ค้นหาสัญญาที่ใกล้หมดอายุภายใน 7 วัน
    console.log('\n🔍 ค้นหาสัญญาที่ใกล้หมดอายุ (ภายใน 7 วัน)...');
    const query = `
      SELECT 
        id,
        contract_no,
        contact_name,
        status,
        TO_CHAR(end_date, 'YYYY-MM-DD') as end_date,
        (end_date::date - CURRENT_DATE) as days_remaining,
        alert_emails,
        department,
        contact_person
      FROM contracts
      WHERE deleted_flag = FALSE 
        AND status IN ('ACTIVE', 'CRTD')
        AND end_date IS NOT NULL
        AND (end_date::date - CURRENT_DATE) BETWEEN 0 AND 7
      ORDER BY days_remaining ASC
    `;
    
    const result = await pool.query(query);
    console.log(`พบ ${result.rows.length} สัญญาที่ใกล้หมดอายุ`);
    
    if (result.rows.length > 0) {
      console.log('\n📋 รายการสัญญา:');
      console.log('================');
      
      for (const contract of result.rows) {
        console.log(`\nสัญญา: ${contract.contract_no}`);
        console.log(`  ชื่อ: ${contract.contact_name || '-'}`);
        console.log(`  สถานะ: ${contract.status}`);
        console.log(`  วันหมดอายุ: ${DateTime.fromISO(contract.end_date).toFormat('dd/MM/yyyy')}`);
        console.log(`  เหลือ: ${contract.days_remaining} วัน`);
        console.log(`  อีเมลแจ้งเตือน: ${contract.alert_emails || 'ไม่มี'}`);
        
        // ส่งอีเมลถ้ามีการตั้งค่า
        if (contract.alert_emails && contract.alert_emails.trim()) {
          const emails = contract.alert_emails.split(',').map(e => e.trim()).filter(Boolean);
          
          if (emails.length > 0) {
            console.log(`\n  📨 กำลังส่งอีเมลไปที่: ${emails.join(', ')}`);
            
            const emailHtml = `
              <!DOCTYPE html>
              <html>
              <head>
                <meta charset="UTF-8">
                <style>
                  body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; }
                  .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                  .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; border-radius: 10px 10px 0 0; }
                  .content { background: #f8f9fa; padding: 30px; border-radius: 0 0 10px 10px; }
                  .alert-box { background: white; padding: 20px; border-left: 4px solid #ff6b6b; margin: 20px 0; border-radius: 5px; }
                  .info-grid { display: grid; grid-template-columns: 150px 1fr; gap: 10px; margin: 20px 0; }
                  .label { font-weight: bold; color: #495057; }
                  .value { color: #212529; }
                  .days-badge { display: inline-block; background: #ff6b6b; color: white; padding: 5px 15px; border-radius: 20px; font-weight: bold; }
                  .footer { text-align: center; color: #6c757d; font-size: 12px; margin-top: 30px; padding-top: 20px; border-top: 1px solid #dee2e6; }
                </style>
              </head>
              <body>
                <div class="container">
                  <div class="header">
                    <h1 style="margin: 0; font-size: 24px;">⚠️ แจ้งเตือนสัญญาใกล้หมดอายุ</h1>
                    <p style="margin: 10px 0 0 0; opacity: 0.9;">Contract Expiry Alert</p>
                  </div>
                  <div class="content">
                    <div class="alert-box">
                      <h2 style="margin: 0 0 10px 0; color: #ff6b6b;">สัญญาต้องดำเนินการ</h2>
                      <p style="margin: 5px 0;">สัญญาดังต่อไปนี้กำลังจะหมดอายุ กรุณาดำเนินการต่ออายุหรือปิดสัญญา</p>
                    </div>
                    
                    <div class="info-grid">
                      <div class="label">เลขที่สัญญา:</div>
                      <div class="value"><strong>${contract.contract_no}</strong></div>
                      
                      <div class="label">ชื่อสัญญา:</div>
                      <div class="value">${contract.contact_name || '-'}</div>
                      
                      <div class="label">หน่วยงาน:</div>
                      <div class="value">${contract.department || '-'}</div>
                      
                      <div class="label">ผู้ติดต่อ:</div>
                      <div class="value">${contract.contact_person || '-'}</div>
                      
                      <div class="label">วันที่หมดอายุ:</div>
                      <div class="value">${DateTime.fromISO(contract.end_date).toFormat('dd MMMM yyyy', {locale: 'th'})}</div>
                      
                      <div class="label">ระยะเวลาคงเหลือ:</div>
                      <div class="value"><span class="days-badge">${contract.days_remaining} วัน</span></div>
                    </div>
                    
                    <div style="background: #fff3cd; padding: 15px; border-radius: 5px; margin-top: 20px;">
                      <p style="margin: 0; color: #856404;">
                        <strong>📌 หมายเหตุ:</strong> กรุณาดำเนินการก่อนสัญญาหมดอายุ เพื่อความต่อเนื่องในการดำเนินงาน
                      </p>
                    </div>
                    
                    <div class="footer">
                      <p>อีเมลนี้ส่งจากระบบจัดการสัญญาอัตโนมัติ</p>
                      <p>Contract Management System - Auto Alert</p>
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
                subject: `⚠️ แจ้งเตือน: สัญญา ${contract.contract_no} ใกล้หมดอายุ (เหลือ ${contract.days_remaining} วัน)`,
                html: emailHtml
              });
              
              console.log(`  ✅ ส่งอีเมลสำเร็จ! Message ID: ${info.messageId}`);
              
              // บันทึก log
              await pool.query(
                `INSERT INTO user_activity_logs (user_id, action, details, ip_address) 
                 VALUES ($1, $2, $3, $4)`,
                ['system', 'ALERT_EMAIL_SENT', 
                 `Sent expiry alert for contract ${contract.contract_no} to ${emails.join(', ')}`,
                 '127.0.0.1']
              );
              
            } catch (emailError) {
              console.error(`  ❌ ส่งอีเมลล้มเหลว:`, emailError.message);
            }
          }
        } else {
          console.log(`  ⚠️ ไม่มีอีเมลแจ้งเตือนสำหรับสัญญานี้`);
        }
      }
    } else {
      console.log('\n✅ ไม่มีสัญญาที่ต้องแจ้งเตือนในขณะนี้');
    }
    
    console.log('\n========================================');
    console.log('✅ ตรวจสอบและส่งการแจ้งเตือนเสร็จสิ้น');
    console.log('========================================\n');
    
  } catch (error) {
    console.error('\n❌ เกิดข้อผิดพลาด:', error.message);
    console.error(error);
  } finally {
    await pool.end();
  }
}

// รันทันที
checkAndSendAlerts();
