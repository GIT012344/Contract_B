// Quick database check
require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME,
  port: process.env.DB_PORT || 5432,
  ssl: { rejectUnauthorized: false }
});

async function quickCheck() {
  try {
    console.log('Checking DB:', process.env.DB_NAME);
    
    // Check tables
    const tables = await pool.query(`
      SELECT tablename FROM pg_tables WHERE schemaname='public'
    `);
    console.log('Tables found:', tables.rows.length);
    tables.rows.forEach(t => console.log('-', t.tablename));
    
    // Check contracts
    const contracts = await pool.query('SELECT COUNT(*) FROM contracts');
    console.log('Contracts:', contracts.rows[0].count);
    
    // Check users
    const users = await pool.query('SELECT COUNT(*) FROM users');
    console.log('Users:', users.rows[0].count);
    
  } catch (err) {
    console.log('Error:', err.message);
    
    if (err.message.includes('does not exist')) {
      console.log('\nTables not found! Creating...');
      
      // Create basic tables
      await pool.query(`
        CREATE TABLE IF NOT EXISTS departments (
          id SERIAL PRIMARY KEY,
          name VARCHAR(100),
          code VARCHAR(20) UNIQUE
        );
        
        CREATE TABLE IF NOT EXISTS users (
          id SERIAL PRIMARY KEY,
          username VARCHAR(100) UNIQUE,
          password VARCHAR(255),
          email VARCHAR(255),
          role VARCHAR(50) DEFAULT 'user'
        );
        
        CREATE TABLE IF NOT EXISTS contracts (
          id SERIAL PRIMARY KEY,
          contract_no VARCHAR(100) UNIQUE,
          contract_name VARCHAR(255),
          vendor_name VARCHAR(255),
          start_date DATE,
          end_date DATE,
          status VARCHAR(50) DEFAULT 'ACTIVE',
          alert_days INTEGER DEFAULT 30,
          alert_emails TEXT
        );
        
        CREATE TABLE IF NOT EXISTS contract_periods (
          id SERIAL PRIMARY KEY,
          contract_id INTEGER REFERENCES contracts(id),
          period_no VARCHAR(50),
          due_date DATE,
          status VARCHAR(50) DEFAULT 'PENDING'
        );
        
        CREATE TABLE IF NOT EXISTS contract_files (
          id SERIAL PRIMARY KEY,
          contract_id INTEGER REFERENCES contracts(id),
          file_name VARCHAR(255),
          file_path VARCHAR(500)
        );
        
        CREATE TABLE IF NOT EXISTS user_activity_logs (
          id SERIAL PRIMARY KEY,
          username VARCHAR(100),
          action_type VARCHAR(50),
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
        
        CREATE TABLE IF NOT EXISTS alert_tracking (
          id SERIAL PRIMARY KEY,
          alert_type VARCHAR(50),
          item_id INTEGER,
          email_address VARCHAR(255),
          sent_date DATE
        );
      `);
      
      console.log('Tables created!');
      
      // Add admin user
      const bcrypt = require('bcryptjs');
      const hash = await bcrypt.hash('admin123', 10);
      await pool.query(
        "INSERT INTO users (username, password, role) VALUES ('admin', $1, 'admin') ON CONFLICT (username) DO NOTHING",
        [hash]
      );
      console.log('Admin user created (admin/admin123)');
    }
  } finally {
    await pool.end();
  }
}

quickCheck();
