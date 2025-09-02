const { Pool } = require('pg');

// Direct connection to Render PostgreSQL
const pool = new Pool({
  connectionString: 'postgresql://git:qEjnGB2aeibSxh9D5jYUDCtlrxtQDKb9@dpg-d2mhh20gjchc73cl92h0-a.singapore-postgres.render.com:5432/datagit_ra1a?sslmode=require',
  ssl: { rejectUnauthorized: false }
});

async function checkAndCreateTable() {
  try {
    // Check if table exists
    const checkResult = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'contract_files'
      )
    `);
    
    if (checkResult.rows[0].exists) {
      console.log('✅ Table contract_files already exists');
      
      // Get table structure
      const columns = await pool.query(`
        SELECT column_name, data_type, is_nullable 
        FROM information_schema.columns 
        WHERE table_name = 'contract_files' 
        ORDER BY ordinal_position
      `);
      
      console.log('\n📋 Table structure:');
      columns.rows.forEach(col => {
        console.log(`  - ${col.column_name}: ${col.data_type} (nullable: ${col.is_nullable})`);
      });
      
      // Count records
      const count = await pool.query('SELECT COUNT(*) FROM contract_files');
      console.log(`\n📊 Total records: ${count.rows[0].count}`);
      
    } else {
      console.log('⚠️ Table contract_files does not exist. Creating...');
      
      // Create table
      await pool.query(`
        CREATE TABLE contract_files (
          id SERIAL PRIMARY KEY,
          contract_id INTEGER NOT NULL,
          file_name VARCHAR(255) NOT NULL,
          file_path VARCHAR(500) NOT NULL,
          file_size BIGINT NOT NULL,
          file_type VARCHAR(100),
          uploaded_by INTEGER,
          uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          deleted_at TIMESTAMP,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (contract_id) REFERENCES contracts(id) ON DELETE CASCADE,
          FOREIGN KEY (uploaded_by) REFERENCES users(id) ON DELETE SET NULL
        )
      `);
      
      // Create indexes
      await pool.query('CREATE INDEX idx_contract_files_contract_id ON contract_files(contract_id)');
      await pool.query('CREATE INDEX idx_contract_files_deleted_at ON contract_files(deleted_at)');
      
      console.log('✅ Table contract_files created successfully');
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await pool.end();
  }
}

checkAndCreateTable();
