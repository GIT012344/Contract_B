// Fix missing alert columns
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

async function fixColumns() {
  try {
    console.log('Adding missing columns...');
    
    // Add alert_days to contracts if not exists
    await pool.query(`
      ALTER TABLE contracts 
      ADD COLUMN IF NOT EXISTS alert_days INTEGER DEFAULT 30
    `);
    console.log('✅ alert_days column added');
    
    // Add alert_emails to contracts if not exists  
    await pool.query(`
      ALTER TABLE contracts 
      ADD COLUMN IF NOT EXISTS alert_emails TEXT
    `);
    console.log('✅ alert_emails column added');
    
    // Add alert_days to contract_periods if not exists
    await pool.query(`
      ALTER TABLE contract_periods 
      ADD COLUMN IF NOT EXISTS alert_days INTEGER DEFAULT 10
    `);
    console.log('✅ period alert_days column added');
    
    // Now update some contracts to be ACTIVE with alert settings
    const result = await pool.query(`
      UPDATE contracts 
      SET 
        status = 'ACTIVE',
        end_date = CASE 
          WHEN end_date < CURRENT_DATE 
          THEN CURRENT_DATE + INTERVAL '30 days'
          ELSE end_date
        END,
        alert_days = 30,
        alert_emails = 'admin@test.com'
      WHERE id IN (
        SELECT id FROM contracts 
        LIMIT 3
      )
      RETURNING contract_no, status, end_date
    `);
    
    console.log('\n✅ Updated contracts:');
    result.rows.forEach(r => {
      console.log(`   ${r.contract_no}: ${r.status} (expires ${r.end_date?.toISOString().split('T')[0]})`);
    });
    
    // Check final status
    const check = await pool.query(`
      SELECT 
        COUNT(*) FILTER (WHERE status = 'ACTIVE') as active,
        COUNT(*) FILTER (WHERE status = 'ACTIVE' AND end_date <= CURRENT_DATE + INTERVAL '30 days') as near_expiry
      FROM contracts
    `);
    
    console.log('\n📊 Final Status:');
    console.log(`   Active contracts: ${check.rows[0].active}`);
    console.log(`   Near expiry (30 days): ${check.rows[0].near_expiry}`);
    
    // Check periods
    const periods = await pool.query(`
      SELECT COUNT(*) as count
      FROM contract_periods cp
      JOIN contracts c ON cp.contract_id = c.id
      WHERE c.status = 'ACTIVE'
        AND cp.status = 'PENDING'
    `);
    
    console.log(`   Pending periods: ${periods.rows[0].count}`);
    
    console.log('\n✅ Database ready for alerts!');
    console.log('The next alert check should find contracts.');
    
  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    await pool.end();
  }
}

fixColumns();
