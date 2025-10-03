// Check why alerts find 0 contracts/periods
require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME,
  port: process.env.DB_PORT || 5432,
  ssl: { rejectUnauthorized: false }
});

async function checkAlertData() {
  try {
    console.log('=== ALERT DATA CHECK ===\n');
    
    // 1. Check all contracts status
    console.log('1. Contract Status Summary:');
    const statusResult = await pool.query(`
      SELECT status, COUNT(*) as count 
      FROM contracts 
      GROUP BY status
    `);
    statusResult.rows.forEach(r => {
      console.log(`   ${r.status}: ${r.count} contracts`);
    });
    
    // 2. Check active/pending contracts
    console.log('\n2. Active/Pending Contracts:');
    const activeResult = await pool.query(`
      SELECT contract_no, contract_name, status, start_date, end_date,
             CASE 
               WHEN end_date < CURRENT_DATE THEN 'EXPIRED'
               WHEN end_date <= CURRENT_DATE + INTERVAL '30 days' THEN 'NEAR EXPIRY'
               ELSE 'OK'
             END as alert_status
      FROM contracts 
      WHERE status IN ('ACTIVE', 'PENDING', 'รอดำเนินการ')
      ORDER BY end_date
    `);
    
    if (activeResult.rows.length === 0) {
      console.log('   ❌ No active/pending contracts found');
    } else {
      activeResult.rows.forEach(c => {
        console.log(`   ${c.contract_no}: ${c.status} | End: ${c.end_date?.toISOString().split('T')[0]} | ${c.alert_status}`);
      });
    }
    
    // 3. Check periods
    console.log('\n3. Contract Periods:');
    const periodsResult = await pool.query(`
      SELECT 
        cp.period_no,
        cp.due_date,
        cp.status as period_status,
        c.contract_no,
        c.status as contract_status
      FROM contract_periods cp
      JOIN contracts c ON cp.contract_id = c.id
      WHERE c.status IN ('ACTIVE', 'PENDING', 'รอดำเนินการ')
        AND cp.status = 'PENDING'
        AND cp.due_date <= CURRENT_DATE + INTERVAL '10 days'
      ORDER BY cp.due_date
      LIMIT 10
    `);
    
    if (periodsResult.rows.length === 0) {
      console.log('   ❌ No pending periods found for alerts');
    } else {
      periodsResult.rows.forEach(p => {
        console.log(`   Contract ${p.contract_no} - Period ${p.period_no}: Due ${p.due_date?.toISOString().split('T')[0]}`);
      });
    }
    
    // 4. Check alert emails
    console.log('\n4. Contracts with Alert Emails:');
    const emailsResult = await pool.query(`
      SELECT contract_no, alert_emails 
      FROM contracts 
      WHERE alert_emails IS NOT NULL 
        AND alert_emails != ''
      LIMIT 5
    `);
    
    if (emailsResult.rows.length === 0) {
      console.log('   ❌ No contracts have alert emails configured');
    } else {
      emailsResult.rows.forEach(c => {
        console.log(`   ${c.contract_no}: ${c.alert_emails}`);
      });
    }
    
    // 5. Fix suggestion
    console.log('\n=== SUGGESTED FIX ===');
    
    // Update expired contracts to ACTIVE for testing
    const expiredCount = await pool.query(`
      SELECT COUNT(*) FROM contracts 
      WHERE end_date < CURRENT_DATE 
        AND status = 'EXPIRED'
    `);
    
    if (parseInt(expiredCount.rows[0].count) > 0) {
      console.log(`\n⚠️ Found ${expiredCount.rows[0].count} expired contracts`);
      console.log('To reactivate for testing, run:');
      console.log(`UPDATE contracts SET 
        status = 'ACTIVE',
        end_date = CURRENT_DATE + INTERVAL '60 days'
      WHERE status = 'EXPIRED' 
      LIMIT 2;`);
    }
    
    // Check if we need to add test data
    const needTestData = activeResult.rows.length === 0;
    if (needTestData) {
      console.log('\n📝 Creating test contract for alerts...');
      
      // Add test contract
      await pool.query(`
        INSERT INTO contracts (
          contract_no, 
          contract_name,
          vendor_name,
          start_date,
          end_date,
          status,
          alert_days,
          alert_emails
        ) VALUES (
          'TEST-2025-001',
          'Test Contract for Alerts',
          'Test Vendor',
          CURRENT_DATE,
          CURRENT_DATE + INTERVAL '25 days',
          'ACTIVE',
          30,
          'admin@test.com'
        ) ON CONFLICT (contract_no) DO NOTHING
      `);
      
      console.log('✅ Test contract created (expires in 25 days)');
      
      // Get contract id
      const testContract = await pool.query(
        "SELECT id FROM contracts WHERE contract_no = 'TEST-2025-001'"
      );
      
      if (testContract.rows.length > 0) {
        // Add test period
        await pool.query(`
          INSERT INTO contract_periods (
            contract_id,
            period_no,
            due_date,
            status
          ) VALUES (
            $1,
            'P001',
            CURRENT_DATE + INTERVAL '5 days',
            'PENDING'
          )
        `, [testContract.rows[0].id]);
        
        console.log('✅ Test period created (due in 5 days)');
      }
    }
    
  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    await pool.end();
  }
}

checkAlertData();
