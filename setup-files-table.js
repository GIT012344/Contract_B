const db = require('./db');

async function setupFilesTable() {
  try {
    // Create contract_files table
    await db.query(`
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
    await db.query(`
      CREATE INDEX IF NOT EXISTS idx_contract_files_contract_id 
      ON contract_files(contract_id)
    `);
    
    await db.query(`
      CREATE INDEX IF NOT EXISTS idx_contract_files_deleted_at 
      ON contract_files(deleted_at)
    `);
    
    console.log('✅ Indexes created successfully');
    
  } catch (error) {
    console.error('Error setting up contract_files table:', error);
  } finally {
    process.exit();
  }
}

setupFilesTable();
