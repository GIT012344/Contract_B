const db = require('./db');

async function updateStatusConstraint() {
  try {
    console.log('Updating status constraint...');
    
    // Drop existing constraint
    await db.query('ALTER TABLE contracts DROP CONSTRAINT IF EXISTS status_check');
    console.log('Dropped existing constraint');
    
    // Add new constraint with COMPLETED and CANCELLED
    await db.query(`
      ALTER TABLE contracts ADD CONSTRAINT status_check 
      CHECK (status IN ('CRTD', 'ACTIVE', 'EXPIRED', 'DELETED'))
    `);
    console.log('Added new constraint with COMPLETED and CANCELLED');
    
    // Update any EXPIRE to EXPIRED for consistency
    const result = await db.query("UPDATE contracts SET status = 'EXPIRED' WHERE status = 'EXPIRE'");
    console.log(`Updated ${result.rowCount} rows from EXPIRE to EXPIRED`);
    
    // Verify the change
    const check = await db.query(`
      SELECT conname, pg_get_constraintdef(oid) as definition
      FROM pg_constraint 
      WHERE conname = 'status_check'
    `);
    
    if (check.rows.length > 0) {
      console.log('✅ Constraint updated successfully:');
      console.log(check.rows[0].definition);
    }
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error updating constraint:', error.message);
    process.exit(1);
  }
}

updateStatusConstraint();
