// ทดสอบการเชื่อมต่อฐานข้อมูลและระบบแจ้งเตือน
require('dotenv').config();

console.log('=== Test Database Connection ===');
console.log('Environment variables loaded');
console.log('DB_HOST:', process.env.DB_HOST);
console.log('DB_PORT:', process.env.DB_PORT);
console.log('DB_NAME:', process.env.DB_NAME);
console.log('DB_USER:', process.env.DB_USER);
console.log('DB_PASS:', process.env.DB_PASS ? 'SET' : 'NOT SET');

const { Pool } = require('pg');

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT) || 5432,
  database: process.env.DB_NAME || 'contract_db',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASS || process.env.DB_PASSWORD || '1234'
});

async function test() {
  try {
    console.log('\nTesting database connection...');
    const result = await pool.query('SELECT NOW() as time, current_database() as db');
    console.log('✓ Connected successfully!');
    console.log('  Database:', result.rows[0].db);
    console.log('  Server time:', result.rows[0].time);
    
    // Test contracts table
    console.log('\nChecking contracts table...');
    const contracts = await pool.query('SELECT COUNT(*) as count FROM contracts WHERE deleted_flag = FALSE');
    console.log('  Active contracts:', contracts.rows[0].count);
    
    // Test periods table
    console.log('\nChecking contract_periods table...');
    const periods = await pool.query('SELECT COUNT(*) as count FROM contract_periods');
    console.log('  Total periods:', periods.rows[0].count);
    
    // Test periods with due dates
    const duePeriods = await pool.query(`
      SELECT COUNT(*) as count 
      FROM contract_periods 
      WHERE due_date IS NOT NULL 
        AND due_date >= CURRENT_DATE
    `);
    console.log('  Future periods:', duePeriods.rows[0].count);
    
    // Test alert configuration
    console.log('\nAlert Configuration:');
    console.log('  ALERT_PERIOD_DUE_DAYS:', process.env.ALERT_PERIOD_DUE_DAYS || '1');
    console.log('  ALERT_CONTRACT_EXPIRY_DAYS:', process.env.ALERT_CONTRACT_EXPIRY_DAYS || '7');
    console.log('  ALERT_SCHEDULE:', process.env.ALERT_SCHEDULE || 'not set');
    
    console.log('\n✓ All tests passed!');
    
  } catch (error) {
    console.error('\n✗ Error occurred:');
    console.error('  Message:', error.message);
    console.error('  Code:', error.code);
    if (error.code === 'ECONNREFUSED') {
      console.error('  → Database server is not running or not accessible');
      console.error('  → Check if PostgreSQL is running on', process.env.DB_HOST || 'localhost');
    } else if (error.code === '28P01') {
      console.error('  → Authentication failed');
      console.error('  → Check username and password in .env file');
    } else if (error.code === '3D000') {
      console.error('  → Database does not exist');
      console.error('  → Check database name in .env file');
    }
  } finally {
    await pool.end();
    console.log('\nConnection closed.');
  }
}

test().catch(console.error);
