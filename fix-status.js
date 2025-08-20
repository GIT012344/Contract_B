const { Pool } = require('pg');

const pool = new Pool({
  host: '127.0.0.1',
  port: 5432,
  user: 'postgres',
  password: '4321',
  database: 'postgres'
});

(async () => {
  try {
    // Drop existing constraint
    await pool.query('ALTER TABLE contracts DROP CONSTRAINT IF EXISTS status_check');
    console.log('Dropped old constraint');
    
    // Add new constraint with COMPLETED and CANCELLED
    await pool.query(`
      ALTER TABLE contracts 
      ADD CONSTRAINT status_check 
      CHECK (status IN ('CRTD', 'ACTIVE', 'EXPIRED', 'DELETED', 'COMPLETED', 'CANCELLED', 'PENDING'))
    `);
    console.log('Added new constraint');
    
    // Verify
    const result = await pool.query(`
      SELECT conname, pg_get_constraintdef(oid) as def 
      FROM pg_constraint 
      WHERE conname = 'status_check'
    `);
    
    if (result.rows.length > 0) {
      console.log('Success! New constraint:', result.rows[0].def);
    }
    
    await pool.end();
  } catch (err) {
    console.error('Error:', err.message);
    await pool.end();
  }
})();
