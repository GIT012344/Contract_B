require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASS
});

async function checkAndFix() {
  try {
    // Check current constraint
    console.log('Checking current constraint...');
    const checkResult = await pool.query(`
      SELECT conname, pg_get_constraintdef(oid) as definition
      FROM pg_constraint 
      WHERE conrelid = 'contracts'::regclass 
      AND conname = 'status_check'
    `);
    
    if (checkResult.rows.length > 0) {
      console.log('Current constraint:', checkResult.rows[0].definition);
      
      // Check if it already includes COMPLETED and CANCELLED
      const definition = checkResult.rows[0].definition;
      if (definition.includes('COMPLETED') && definition.includes('CANCELLED')) {
        console.log('✅ Constraint already includes COMPLETED and CANCELLED!');
        pool.end();
        return;
      }
    }
    
    // Fix the constraint
    console.log('\nFixing constraint...');
    
    // Drop old constraint
    await pool.query('ALTER TABLE contracts DROP CONSTRAINT IF EXISTS status_check');
    console.log('- Old constraint dropped');
    
    // Add new constraint
    await pool.query(`
      ALTER TABLE contracts 
      ADD CONSTRAINT status_check 
      CHECK (status IN ('CRTD', 'ACTIVE', 'EXPIRED', 'DELETED'))
    `);
    console.log('- New constraint added');
    
    // Verify the fix
    const verifyResult = await pool.query(`
      SELECT pg_get_constraintdef(oid) as definition
      FROM pg_constraint 
      WHERE conrelid = 'contracts'::regclass 
      AND conname = 'status_check'
    `);
    
    console.log('\n✅ SUCCESS! New constraint:', verifyResult.rows[0].definition);
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    
    // If error is about invalid values, show which contracts have problematic statuses
    if (error.message.includes('check constraint')) {
      console.log('\nChecking for contracts with invalid statuses...');
      const contracts = await pool.query(`
        SELECT id, contract_no, status 
        FROM contracts 
        WHERE status NOT IN ('CRTD', 'ACTIVE', 'EXPIRED', 'DELETED')
      `);
      if (contracts.rows.length > 0) {
        console.log('Found contracts with invalid statuses:', contracts.rows);
      }
    }
  } finally {
    await pool.end();
  }
}

checkAndFix();
