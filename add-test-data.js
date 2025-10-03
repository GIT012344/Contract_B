// Add test data for alert system
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

async function addTestData() {
  try {
    // 1. Update some contracts to ACTIVE with future dates
    const updateResult = await pool.query(`
      UPDATE contracts 
      SET 
        status = 'ACTIVE',
        end_date = CURRENT_DATE + INTERVAL '20 days',
        alert_days = 30,
        alert_emails = 'admin@test.com'
      WHERE id IN (
        SELECT id FROM contracts 
        WHERE status != 'ACTIVE'
        LIMIT 2
      )
      RETURNING contract_no, end_date
    `);
    
    console.log('Updated contracts:', updateResult.rows.length);
    
    // 2. Add new test contract
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
        'ALERT-TEST-' || TO_CHAR(NOW(), 'YYYYMMDD'),
        'Alert Test Contract',
        'Test Vendor',
        CURRENT_DATE,
        CURRENT_DATE + INTERVAL '15 days',
        'ACTIVE',
        30,
        'test@example.com'
      ) ON CONFLICT (contract_no) DO NOTHING
    `);
    
    console.log('Test contract added');
    
    // 3. Add periods
    const contractResult = await pool.query(`
      SELECT id FROM contracts 
      WHERE status = 'ACTIVE' 
      ORDER BY id DESC 
      LIMIT 1
    `);
    
    if (contractResult.rows.length > 0) {
      await pool.query(`
        INSERT INTO contract_periods (
          contract_id,
          period_no,
          due_date,
          status
        ) VALUES 
        ($1, 'TEST-01', CURRENT_DATE + INTERVAL '3 days', 'PENDING'),
        ($1, 'TEST-02', CURRENT_DATE + INTERVAL '7 days', 'PENDING')
        ON CONFLICT DO NOTHING
      `, [contractResult.rows[0].id]);
      
      console.log('Test periods added');
    }
    
    // 4. Check results
    const checkResult = await pool.query(`
      SELECT 
        (SELECT COUNT(*) FROM contracts WHERE status = 'ACTIVE') as active_contracts,
        (SELECT COUNT(*) FROM contract_periods WHERE status = 'PENDING') as pending_periods
    `);
    
    console.log('Active contracts:', checkResult.rows[0].active_contracts);
    console.log('Pending periods:', checkResult.rows[0].pending_periods);
    
    console.log('\nDone! Alert system should now find contracts and periods.');
    
  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    await pool.end();
  }
}

addTestData();
