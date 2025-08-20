require('dotenv').config();
const { Pool } = require('pg');

// Database connection
const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'contract_db',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASS || ''
});

async function fixConstraint() {
  const client = await pool.connect();
  
  try {
    console.log('Starting constraint fix...');
    
    // Start transaction
    await client.query('BEGIN');
    
    // Drop the old constraint
    console.log('Dropping old constraint...');
    await client.query('ALTER TABLE contracts DROP CONSTRAINT IF EXISTS status_check');
    
    // Add the new constraint with all valid statuses
    console.log('Adding new constraint...');
    await client.query(`
      ALTER TABLE contracts 
      ADD CONSTRAINT status_check 
      CHECK (status IN ('CRTD', 'ACTIVE', 'EXPIRED', 'DELETED', 'COMPLETED', 'CANCELLED', 'PENDING'))
    `);
    
    // Commit transaction
    await client.query('COMMIT');
    
    console.log('✅ Constraint updated successfully!');
    console.log('New valid statuses: CRTD, ACTIVE, EXPIRED, DELETED, COMPLETED, CANCELLED, PENDING');
    
  } catch (error) {
    // Rollback on error
    await client.query('ROLLBACK');
    console.error('❌ Error updating constraint:', error.message);
    process.exit(1);
  } finally {
    client.release();
    pool.end();
  }
}

// Run the fix
fixConstraint().then(() => {
  console.log('Done!');
  process.exit(0);
}).catch(err => {
  console.error('Failed:', err);
  process.exit(1);
});
