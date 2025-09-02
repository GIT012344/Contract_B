const { Pool } = require('pg');

// Direct connection to Render PostgreSQL
const pool = new Pool({
  host: 'dpg-d2mhh20gjchc73cl92h0-a.singapore-postgres.render.com',
  user: 'git',
  password: 'qEjnGB2aeibSxh9D5jYUDCtlrxtQDKb9',
  database: 'datagit_ra1a',
  port: 5432,
  ssl: {
    rejectUnauthorized: false
  }
});

async function setupFilesTable() {
  try {
    // Create contract_files table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS contract_files (
        id SERIAL PRIMARY KEY,
        contract_id INTEGER NOT NULL REFERENCES contracts(id) ON DELETE CASCADE,
        file_name VARCHAR(255) NOT NULL,
        file_path VARCHAR(500) NOT NULL,
        file_size BIGINT NOT NULL,
        file_type VARCHAR(100),
        uploaded_by INTEGER REFERENCES users(id),
        uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        deleted_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    console.log('✅ Table contract_files created successfully');
    
    // Create indexes
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_contract_files_contract_id 
      ON contract_files(contract_id)
    `);
    
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_contract_files_deleted_at 
      ON contract_files(deleted_at)
    `);
    
    console.log('✅ Indexes created successfully');
    
    // Check if table exists
    const result = await pool.query(`
      SELECT COUNT(*) FROM information_schema.tables 
      WHERE table_name = 'contract_files'
    `);
    
    console.log('✅ Table verification:', result.rows[0].count > 0 ? 'Table exists' : 'Table not found');
    
  } catch (error) {
    console.error('Error setting up contract_files table:', error.message);
  } finally {
    await pool.end();
    process.exit();
  }
}

setupFilesTable();
