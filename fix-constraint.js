const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASS || '4321',
  database: process.env.DB_NAME || 'postgres'
});

async function fixConstraint() {
  const client = await pool.connect();
  try {
    console.log('Starting constraint fix...');
    
    // Start transaction
    await client.query('BEGIN');
    
    // Drop old constraint
    const dropResult = await client.query(`
      ALTER TABLE contracts 
      DROP CONSTRAINT IF EXISTS status_check
    `);
    console.log('✅ Dropped old constraint');
    
    // Add new constraint with COMPLETED and CANCELLED
    const addResult = await client.query(`
      ALTER TABLE contracts 
      ADD CONSTRAINT status_check 
      CHECK (status IN ('CRTD', 'ACTIVE', 'EXPIRED', 'DELETED', 'COMPLETED', 'CANCELLED', 'PENDING'))
    `);
    console.log('✅ Added new constraint with COMPLETED and CANCELLED');
    
    // Commit transaction
    await client.query('COMMIT');
    console.log('✅ Transaction committed successfully');
    
    // Verify the constraint
    const verifyResult = await client.query(`
      SELECT 
        con.conname as constraint_name,
        pg_get_constraintdef(con.oid) as definition
      FROM pg_constraint con
      JOIN pg_class rel ON rel.oid = con.conrelid
      WHERE rel.relname = 'contracts' 
        AND con.conname = 'status_check'
    `);
    
    if (verifyResult.rows.length > 0) {
      console.log('\n✅ Constraint verified successfully:');
      console.log(verifyResult.rows[0].definition);
    }
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Error:', error.message);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

fixConstraint()
  .then(() => {
    console.log('\n✅ Database constraint fixed successfully!');
    process.exit(0);
  })
  .catch((err) => {
    console.error('\n❌ Failed to fix constraint:', err.message);
    process.exit(1);
  });
