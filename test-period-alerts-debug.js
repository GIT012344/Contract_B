// Debug script for period alerts
require('dotenv').config();
const db = require('./db');
const alertService = require('./services/alertService');

async function debugPeriodAlerts() {
  try {
    console.log('========================================');
    console.log('🔍 Debug Period Alerts');
    console.log('Current Date:', new Date().toLocaleDateString('th-TH'));
    console.log('========================================\n');
    
    // 1. Check all periods with their alert settings
    console.log('📋 All Periods with Alert Settings:\n');
    const allPeriods = await db.query(`
      SELECT 
        c.contract_no,
        c.alert_emails,
        p.id,
        p.period_no,
        p.due_date,
        p.alert_days,
        p.status,
        (p.due_date::date - CURRENT_DATE) as days_until_due
      FROM contract_periods p
      JOIN contracts c ON p.contract_id = c.id
      WHERE c.deleted_flag = FALSE
        AND p.due_date IS NOT NULL
      ORDER BY days_until_due ASC
    `);
    
    console.log(`Found ${allPeriods.rows.length} periods total\n`);
    
    allPeriods.rows.forEach(period => {
      console.log(`Contract: ${period.contract_no} - Period ${period.period_no}`);
      console.log(`  Due Date: ${new Date(period.due_date).toLocaleDateString('th-TH')}`);
      console.log(`  Days Until Due: ${period.days_until_due}`);
      console.log(`  Alert Days: ${period.alert_days || 'NOT SET'}`);
      console.log(`  Status: ${period.status}`);
      console.log(`  Emails: ${period.alert_emails ? '✓' : '✗'}`);
      
      if (period.alert_days && period.days_until_due <= period.alert_days && period.days_until_due >= 0) {
        console.log(`  ⚠️ SHOULD TRIGGER ALERT!`);
      }
      console.log('');
    });
    
    // 2. Test the actual alert function
    console.log('\n========================================');
    console.log('🔔 Periods that should trigger alerts:');
    console.log('========================================\n');
    
    const upcomingPeriods = await alertService.checkUpcomingPeriods();
    
    if (upcomingPeriods.length > 0) {
      console.log(`Found ${upcomingPeriods.length} periods that should trigger alerts:\n`);
      
      upcomingPeriods.forEach(period => {
        console.log(`✓ Contract ${period.contract_no} - Period ${period.period_no}`);
        console.log(`  Due: ${new Date(period.due_date).toLocaleDateString('th-TH')}`);
        console.log(`  Days remaining: ${period.days_remaining}`);
        console.log(`  Alert days: ${period.alert_days}`);
        console.log(`  Will send to: ${period.alert_emails || 'NO EMAILS SET'}`);
        console.log('');
      });
    } else {
      console.log('❌ No periods found that should trigger alerts');
      console.log('\nPossible reasons:');
      console.log('1. No periods have alert_days set');
      console.log('2. No periods are within their alert window');
      console.log('3. All qualifying periods have status = "เสร็จสิ้น"');
      console.log('4. Contracts are deleted or have no alert_emails');
    }
    
    // 3. Test manual alert sending
    console.log('\n========================================');
    console.log('📧 Testing Alert Email System:');
    console.log('========================================\n');
    
    const testResult = await alertService.runDailyAlerts();
    console.log('Alert system result:', testResult);
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    process.exit();
  }
}

debugPeriodAlerts();
