// ทดสอบระบบแจ้งเตือนแบบละเอียด
require('dotenv').config();
const { Pool } = require('pg');
const { DateTime } = require('luxon');
const nodemailer = require('nodemailer');

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT) || 5432,
  database: process.env.DB_NAME || 'contract_db',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASS || process.env.DB_PASSWORD || '1234'
});

// Email config
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_SENDER || 'moonlightvilip@gmail.com',
    pass: 'lwnj edbh cnby uvuq'
  },
  tls: {
    rejectUnauthorized: false
  }
});

async function testAlertSystem() {
  console.log('========== TEST ALERT SYSTEM ==========');
  console.log('Current Time:', DateTime.now().setZone('Asia/Bangkok').toFormat('dd/MM/yyyy HH:mm:ss'));
  console.log('Alert Period Days:', process.env.ALERT_PERIOD_DUE_DAYS || 1);
  
  try {
    // Test 1: Check database connection
    console.log('\n1. Testing database connection...');
    const testConn = await pool.query('SELECT NOW()');
    console.log('   ✓ Database connected:', testConn.rows[0].now);
    
    // Test 2: Check contracts with periods
    console.log('\n2. Checking contracts with periods...');
    const contractsWithPeriods = await pool.query(`
      SELECT DISTINCT c.contract_no, c.status, c.alert_emails,
             COUNT(p.id) as period_count
      FROM contracts c
      LEFT JOIN contract_periods p ON c.id = p.contract_id
      WHERE c.deleted_flag = FALSE
      GROUP BY c.contract_no, c.status, c.alert_emails
      LIMIT 10
    `);
    console.log(`   Found ${contractsWithPeriods.rows.length} contracts`);
    
    contractsWithPeriods.rows.forEach(c => {
      console.log(`   - ${c.contract_no}: ${c.period_count} periods, status=${c.status}, emails=${c.alert_emails ? 'YES' : 'NO'}`);
    });
    
    // Test 3: Check periods that should trigger alerts
    console.log('\n3. Checking periods for alerts...');
    const alertDays = parseInt(process.env.ALERT_PERIOD_DUE_DAYS) || 1;
    
    const periodsToAlert = await pool.query(`
      SELECT c.contract_no, c.contact_name, c.status, c.alert_emails,
             p.period_no, p.due_date, p.alert_days,
             (p.due_date::date - CURRENT_DATE) as days_until_due
      FROM contracts c
      JOIN contract_periods p ON c.id = p.contract_id
      WHERE c.deleted_flag = FALSE
        AND c.status IN ('ACTIVE', 'CRTD')
        AND p.due_date IS NOT NULL
        AND p.due_date >= CURRENT_DATE
        AND (p.due_date::date - CURRENT_DATE) <= GREATEST(COALESCE(p.alert_days, 0), $1)
        AND c.alert_emails IS NOT NULL 
        AND c.alert_emails != ''
      ORDER BY days_until_due ASC
    `, [alertDays]);
    
    console.log(`   Found ${periodsToAlert.rows.length} periods to alert`);
    
    if (periodsToAlert.rows.length > 0) {
      console.log('\n   Periods requiring alerts:');
      periodsToAlert.rows.forEach(p => {
        const dueDate = DateTime.fromISO(p.due_date).toFormat('dd/MM/yyyy');
        console.log(`   - ${p.contract_no} Period ${p.period_no}: Due ${dueDate} (${p.days_until_due} days)`);
      });
      
      // Test 4: Send test email
      console.log('\n4. Sending test alert email...');
      const testPeriod = periodsToAlert.rows[0];
      const emails = testPeriod.alert_emails.split(',').map(e => e.trim()).filter(Boolean);
      
      const html = `
        <h2>Test Alert: Period Due Soon</h2>
        <p>Contract: ${testPeriod.contract_no}</p>
        <p>Period: ${testPeriod.period_no}</p>
        <p>Due Date: ${DateTime.fromISO(testPeriod.due_date).toFormat('dd/MM/yyyy')}</p>
        <p>Days Remaining: ${testPeriod.days_until_due}</p>
        <p>Test Time: ${DateTime.now().setZone('Asia/Bangkok').toFormat('dd/MM/yyyy HH:mm:ss')}</p>
      `;
      
      try {
        const info = await transporter.sendMail({
          from: 'Contract System <moonlightvilip@gmail.com>',
          to: emails.join(','),
          subject: `[TEST] Period Alert - ${testPeriod.contract_no}`,
          html: html
        });
        console.log('   ✓ Email sent successfully!');
        console.log('   Message ID:', info.messageId);
        console.log('   To:', emails.join(', '));
      } catch (emailErr) {
        console.log('   ✗ Email failed:', emailErr.message);
      }
    } else {
      console.log('\n   No periods matching alert criteria');
      
      // Check why no alerts
      console.log('\n   Checking all periods status:');
      const allPeriods = await pool.query(`
        SELECT c.contract_no, c.status, c.alert_emails,
               p.period_no, p.due_date, p.alert_days,
               (p.due_date::date - CURRENT_DATE) as days_until_due
        FROM contracts c
        JOIN contract_periods p ON c.id = p.contract_id
        WHERE c.deleted_flag = FALSE
          AND p.due_date IS NOT NULL
        ORDER BY days_until_due ASC
        LIMIT 5
      `);
      
      allPeriods.rows.forEach(p => {
        const issues = [];
        if (!['ACTIVE', 'CRTD'].includes(p.status)) issues.push('status not ACTIVE/CRTD');
        if (!p.alert_emails) issues.push('no alert_emails');
        if (p.days_until_due > alertDays && p.days_until_due > (p.alert_days || 0)) issues.push('not due yet');
        if (p.due_date < new Date()) issues.push('already past due');
        
        const dueDate = p.due_date ? DateTime.fromISO(p.due_date).toFormat('dd/MM/yyyy') : 'N/A';
        console.log(`   - ${p.contract_no} P${p.period_no}: ${dueDate} (${p.days_until_due}d) - Issues: ${issues.join(', ') || 'none'}`);
      });
    }
    
    console.log('\n========== TEST COMPLETE ==========');
    
  } catch (error) {
    console.error('Error:', error.message);
    console.error(error.stack);
  } finally {
    await pool.end();
  }
}

testAlertSystem();
