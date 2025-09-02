const db = require('./db');

async function createFilesTable() {
  try {
    // Check if table exists
    const checkTable = await db.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'contract_files'
      )
    `);

    if (!checkTable.rows[0].exists) {
      console.log('Creating contract_files table...');
      
      await db.query(`
        CREATE TABLE contract_files (
          id SERIAL PRIMARY KEY,
          contract_id INT REFERENCES contracts(id) ON DELETE CASCADE,
          filename VARCHAR(255),
          path VARCHAR(255),
          mimetype VARCHAR(100),
          uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);
      
      console.log('✅ contract_files table created successfully');
    } else {
      console.log('✅ contract_files table already exists');
    }
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    process.exit(0);
  }
}

createFilesTable();
