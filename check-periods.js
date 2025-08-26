// ตรวจสอบข้อมูลงวดงานในฐานข้อมูล
require('dotenv').config();
const { Pool } = require('pg');
const { DateTime } = require('luxon');

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT) || 5432,
  database: process.env.DB_NAME || 'contract_db',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASS || process.env.DB_PASSWORD || '1234'
});

async function checkPeriods() {
  console.log('\n========================================');
  console.log('📊 ตรวจสอบข้อมูลงวดงานในระบบ');
  console.log('========================================\n');
  
  try {
    // 1. ตรวจสอบงวดงานทั้งหมด
    const allPeriods = await pool.query(`
      SELECT c.contract_no, c.contact_name, c.status as contract_status,
             c.alert_emails, p.period_no, 
             TO_CHAR(p.due_date, 'YYYY-MM-DD') as due_date,
             p.alert_days,
             (p.due_date::date - CURRENT_DATE) as days_until_due
      FROM contracts c
      JOIN contract_periods p ON c.id = p.contract_id
      WHERE c.deleted_flag = FALSE
      ORDER BY days_until_due ASC, c.contract_no, p.period_no
      LIMIT 20
    `);
    
    console.log(`พบงวดงานทั้งหมด: ${allPeriods.rows.length} งวด\n`);
    
    if (allPeriods.rows.length > 0) {
      console.log('รายละเอียดงวดงาน:');
      console.log('=====================================');
      
      for (const period of allPeriods.rows) {
        const dueDate = period.due_date ? DateTime.fromISO(period.due_date).toFormat('dd/MM/yyyy') : '-';
        console.log(`\nสัญญา: ${period.contract_no}`);
        console.log(`  ชื่อ: ${period.contact_name || '-'}`);
        console.log(`  สถานะ: ${period.contract_status}`);
        console.log(`  งวดที่: ${period.period_no}`);
        console.log(`  วันครบกำหนด: ${dueDate}`);
        console.log(`  เหลือ: ${period.days_until_due !== null ? period.days_until_due + ' วัน' : '-'}`);
        console.log(`  แจ้งล่วงหน้า: ${period.alert_days || '0'} วัน`);
        console.log(`  อีเมล: ${period.alert_emails ? 'มี' : 'ไม่มี'}`);
      }
    }
    
    // 2. ตรวจสอบงวดที่ควรแจ้งเตือน (ใช้ query เดียวกับ alertJob)
    const alertDays = parseInt(process.env.ALERT_PERIOD_DUE_DAYS) || 1;
    console.log(`\n\n🔔 งวดที่ควรแจ้งเตือน (ALERT_PERIOD_DUE_DAYS = ${alertDays}):`);
    console.log('=====================================');
    
    const alertPeriods = await pool.query(`
      SELECT c.contract_no, c.contact_name, c.department, c.alert_emails, 
             c.contact_person, p.period_no, p.due_date, p.alert_days,
             (p.due_date::date - CURRENT_DATE) as days_until_due
      FROM contracts c
      JOIN contract_periods p ON c.id = p.contract_id
      WHERE c.deleted_flag = FALSE
        AND c.status IN ('ACTIVE', 'CRTD')
        AND p.due_date IS NOT NULL
        AND p.due_date >= CURRENT_DATE
        AND (p.due_date::date - CURRENT_DATE) <= GREATEST(COALESCE(p.alert_days, 0), $1)
        AND c.alert_emails IS NOT NULL AND c.alert_emails != ''
    `, [alertDays]);
    
    console.log(`พบ ${alertPeriods.rows.length} งวดที่ต้องแจ้งเตือน\n`);
    
    if (alertPeriods.rows.length > 0) {
      for (const period of alertPeriods.rows) {
        const dueDate = period.due_date ? DateTime.fromISO(period.due_date).toFormat('dd/MM/yyyy') : '-';
        console.log(`✅ ${period.contract_no} - งวดที่ ${period.period_no}`);
        console.log(`   วันครบกำหนด: ${dueDate} (เหลือ ${period.days_until_due} วัน)`);
        console.log(`   อีเมล: ${period.alert_emails}`);
      }
    } else {
      console.log('❌ ไม่มีงวดที่ต้องแจ้งเตือน');
      console.log('\nเหตุผลที่อาจไม่มีการแจ้งเตือน:');
      console.log('1. สัญญาไม่ใช่สถานะ ACTIVE หรือ CRTD');
      console.log('2. ไม่มีอีเมลแจ้งเตือน (alert_emails)');
      console.log('3. งวดงานยังไม่ถึงเวลาแจ้งเตือน');
      console.log('4. ไม่มีข้อมูล due_date');
    }
    
    // 3. ตรวจสอบการตั้งค่า
    console.log('\n\n⚙️ การตั้งค่าปัจจุบัน:');
    console.log('=====================================');
    console.log(`ALERT_PERIOD_DUE_DAYS: ${process.env.ALERT_PERIOD_DUE_DAYS || '1'}`);
    console.log(`ALERT_CONTRACT_EXPIRY_DAYS: ${process.env.ALERT_CONTRACT_EXPIRY_DAYS || '7'}`);
    console.log(`ALERT_SCHEDULE: ${process.env.ALERT_SCHEDULE || '* * * * *'}`);
    
  } catch (error) {
    console.error('\n❌ เกิดข้อผิดพลาด:', error.message);
    console.error(error);
  } finally {
    await pool.end();
  }
}

checkPeriods();
