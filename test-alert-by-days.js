// ทดสอบระบบแจ้งเตือนตาม alert_days ของแต่ละงวด
require('dotenv').config();
const { Pool } = require('pg');
const { DateTime } = require('luxon');

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT) || 5432,
  database: process.env.DB_NAME || 'contract_db',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASS || '1234'
});

async function testAlertByDays() {
  console.log('========================================');
  console.log('🔔 ทดสอบระบบแจ้งเตือนตาม Alert Days');
  console.log('วันที่ปัจจุบัน:', DateTime.now().setZone('Asia/Bangkok').toFormat('dd/MM/yyyy'));
  console.log('========================================\n');
  
  try {
    // 1. แสดงงวดงานทั้งหมดพร้อม alert_days
    console.log('📋 งวดงานที่มีในระบบ:\n');
    const allPeriods = await pool.query(`
      SELECT c.contract_no, c.status, c.alert_emails,
             p.period_no, TO_CHAR(p.due_date, 'YYYY-MM-DD') as due_date,
             p.alert_days,
             (p.due_date::date - CURRENT_DATE) as days_until_due
      FROM contracts c
      JOIN contract_periods p ON c.id = p.contract_id
      WHERE c.deleted_flag = FALSE
        AND c.status IN ('ACTIVE', 'CRTD')
        AND p.due_date IS NOT NULL
        AND p.due_date >= CURRENT_DATE
      ORDER BY c.contract_no, p.period_no
    `);
    
    console.log(`พบ ${allPeriods.rows.length} งวดงาน\n`);
    
    for (const period of allPeriods.rows) {
      const dueDate = DateTime.fromISO(period.due_date);
      console.log(`📌 สัญญา: ${period.contract_no} - งวดที่ ${period.period_no}`);
      console.log(`   วันครบกำหนด: ${dueDate.toFormat('dd/MM/yyyy')}`);
      console.log(`   เหลือ: ${period.days_until_due} วัน`);
      console.log(`   แจ้งล่วงหน้า: ${period.alert_days || 'ไม่ได้ตั้ง'} วัน`);
      console.log(`   อีเมล: ${period.alert_emails ? '✓ มี' : '✗ ไม่มี'}`);
      
      // ตรวจสอบว่าควรแจ้งเตือนหรือไม่
      if (period.alert_days && period.days_until_due == period.alert_days) {
        console.log(`   ⚠️ >>> ควรแจ้งเตือนวันนี้! <<<`);
      }
      console.log('');
    }
    
    // 2. แสดงงวดที่ต้องแจ้งเตือนวันนี้ (ตาม query ที่ใช้จริง)
    console.log('\n========================================');
    console.log('🔔 งวดที่ต้องแจ้งเตือนวันนี้:');
    console.log('========================================\n');
    
    const todayAlerts = await pool.query(`
      SELECT c.contract_no, c.contact_name, c.department, c.alert_emails,
             p.period_no, p.due_date, p.alert_days,
             (p.due_date::date - CURRENT_DATE) as days_until_due
      FROM contracts c
      JOIN contract_periods p ON c.id = p.contract_id
      WHERE c.deleted_flag = FALSE
        AND c.status IN ('ACTIVE', 'CRTD')
        AND p.due_date IS NOT NULL
        AND p.due_date >= CURRENT_DATE
        AND p.alert_days IS NOT NULL
        AND p.alert_days > 0
        AND (p.due_date::date - CURRENT_DATE) = p.alert_days
        AND c.alert_emails IS NOT NULL 
        AND c.alert_emails != ''
    `);
    
    if (todayAlerts.rows.length > 0) {
      console.log(`✅ พบ ${todayAlerts.rows.length} งวดที่ต้องแจ้งเตือนวันนี้:\n`);
      
      for (const alert of todayAlerts.rows) {
        const dueDate = DateTime.fromISO(alert.due_date);
        console.log(`📧 สัญญา: ${alert.contract_no} - ${alert.contact_name || 'ไม่มีชื่อ'}`);
        console.log(`   งวดที่: ${alert.period_no}`);
        console.log(`   วันครบกำหนด: ${dueDate.toFormat('dd/MM/yyyy')}`);
        console.log(`   แจ้งล่วงหน้า: ${alert.alert_days} วัน (เหลือ ${alert.days_until_due} วัน)`);
        console.log(`   ส่งถึง: ${alert.alert_emails}`);
        console.log('');
      }
    } else {
      console.log('❌ ไม่มีงวดที่ต้องแจ้งเตือนวันนี้\n');
      console.log('เหตุผลที่อาจไม่มีการแจ้งเตือน:');
      console.log('1. ไม่มีงวดที่ตรงกับเงื่อนไข (days_until_due = alert_days)');
      console.log('2. งวดที่ถึงเวลาแจ้งเตือนไม่มี alert_emails');
      console.log('3. สัญญาไม่ใช่สถานะ ACTIVE หรือ CRTD');
    }
    
    // 3. แสดงการตั้งค่า Cron Schedule
    console.log('\n========================================');
    console.log('⚙️ การตั้งค่า Alert Schedule:');
    console.log('========================================\n');
    console.log(`ALERT_SCHEDULE: ${process.env.ALERT_SCHEDULE || '0 8 * * *'}`);
    
    if (process.env.ALERT_SCHEDULE === '0 8 * * *') {
      console.log('→ แจ้งเตือนเวลา 8:00 น. ทุกวัน (Production)');
    } else if (process.env.ALERT_SCHEDULE === '* * * * *') {
      console.log('→ แจ้งเตือนทุกนาที (Testing)');
    }
    
    console.log('\n✅ ทดสอบเสร็จสิ้น');
    
  } catch (error) {
    console.error('❌ เกิดข้อผิดพลาด:', error.message);
  } finally {
    await pool.end();
  }
}

testAlertByDays();
