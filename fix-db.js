const { Client } = require('pg');
require('dotenv').config();

const client = new Client({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASS || '4321',
  database: process.env.DB_NAME || 'postgres'
});

async function fixDatabase() {
  try {
    await client.connect();
    console.log('Connected to database');
    
    // Drop existing constraint
    try {
      await client.query('ALTER TABLE contracts DROP CONSTRAINT status_check');
      console.log('✅ Dropped old status_check constraint');
    } catch (e) {
      console.log('⚠️ No existing status_check constraint to drop');
    }
    
    // Add new constraint
    await client.query(`
      ALTER TABLE contracts 
      ADD CONSTRAINT status_check 
      CHECK (status IN ('CRTD', 'ACTIVE', 'EXPIRED', 'DELETED', 'COMPLETED', 'CANCELLED', 'PENDING'))
    `);
    console.log('✅ Added new status_check constraint with COMPLETED and CANCELLED');
    
    // Update EXPIRE to EXPIRED
    const updateResult = await client.query("UPDATE contracts SET status = 'EXPIRED' WHERE status = 'EXPIRE'");
    console.log(`✅ Updated ${updateResult.rowCount} rows from EXPIRE to EXPIRED`);
    
    // Verify
    const check = await client.query(`
      SELECT conname, pg_get_constraintdef(oid) as definition
      FROM pg_constraint 
      WHERE conname = 'status_check' AND conrelid = 'contracts'::regclass
    `);
    
    if (check.rows.length > 0) {
      console.log('✅ Constraint verified:');
      console.log(check.rows[0].definition);
    }
    
    await client.end();
    console.log('✅ Database fixed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    await client.end();
    process.exit(1);
  }
}

fixDatabase();
