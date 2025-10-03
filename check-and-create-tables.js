/**
 * Script to check and create tables in the new production database
 * Run this to ensure all tables exist in the new DB
 */

require('dotenv').config();
const { Pool } = require('pg');

// Use the new production database
const pool = new Pool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME,
  port: process.env.DB_PORT || 5432,
  ssl: {
    rejectUnauthorized: false
  }
});

async function checkAndCreateTables() {
  console.log('\n========================================');
  console.log('📊 Checking Database Tables');
  console.log('========================================\n');
  
  console.log('Database Config:');
  console.log('  Host:', process.env.DB_HOST);
  console.log('  Database:', process.env.DB_NAME);
  console.log('  User:', process.env.DB_USER);
  console.log('');

  try {
    // Test connection
    await pool.query('SELECT NOW()');
    console.log('✅ Database connection successful\n');

    // Check existing tables
    const tablesResult = await pool.query(`
      SELECT tablename 
      FROM pg_tables 
      WHERE schemaname = 'public'
      ORDER BY tablename;
    `);
    
    console.log('📋 Existing tables:');
    if (tablesResult.rows.length === 0) {
      console.log('  ❌ No tables found! Database is empty.');
    } else {
      tablesResult.rows.forEach(row => {
        console.log(`  ✅ ${row.tablename}`);
      });
    }
    console.log('');

    // Define required tables
    const requiredTables = [
      'users',
      'departments', 
      'contracts',
      'contract_periods',
      'contract_files',
      'user_activity_logs',
      'alert_tracking'
    ];

    // Check which tables are missing
    const existingTables = tablesResult.rows.map(r => r.tablename);
    const missingTables = requiredTables.filter(t => !existingTables.includes(t));

    if (missingTables.length > 0) {
      console.log('⚠️ Missing tables:', missingTables.join(', '));
      console.log('\n🔧 Creating missing tables...\n');

      // Create tables SQL
      const createTablesSql = `
        -- 1. Create Users Table
        CREATE TABLE IF NOT EXISTS users (
          id SERIAL PRIMARY KEY,
          username VARCHAR(100) UNIQUE NOT NULL,
          password VARCHAR(255) NOT NULL,
          email VARCHAR(255),
          role VARCHAR(50) DEFAULT 'user',
          is_active BOOLEAN DEFAULT true,
          department_id INTEGER,
          ldap_dn VARCHAR(255),
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        -- 2. Create Departments Table
        CREATE TABLE IF NOT EXISTS departments (
          id SERIAL PRIMARY KEY,
          name VARCHAR(100) NOT NULL,
          code VARCHAR(20) UNIQUE NOT NULL,
          description TEXT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        -- 3. Create Contracts Table
        CREATE TABLE IF NOT EXISTS contracts (
          id SERIAL PRIMARY KEY,
          contract_no VARCHAR(100) UNIQUE NOT NULL,
          contract_name VARCHAR(255) NOT NULL,
          vendor_name VARCHAR(255) NOT NULL,
          department_id INTEGER REFERENCES departments(id),
          contract_type VARCHAR(100),
          start_date DATE NOT NULL,
          end_date DATE NOT NULL,
          amount DECIMAL(15, 2),
          period_count INTEGER DEFAULT 1,
          payment_terms VARCHAR(255),
          contact_name VARCHAR(255),
          contact_email VARCHAR(255),
          contact_phone VARCHAR(50),
          status VARCHAR(50) DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'EXPIRED', 'DELETED', 'PENDING', 'รอดำเนินการ', 'COMPLETED', 'เสร็จสิ้น', 'CANCELLED', 'ยกเลิก')),
          alert_days INTEGER DEFAULT 30,
          alert_emails TEXT,
          description TEXT,
          created_by VARCHAR(100),
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        -- 4. Create Contract Periods Table
        CREATE TABLE IF NOT EXISTS contract_periods (
          id SERIAL PRIMARY KEY,
          contract_id INTEGER REFERENCES contracts(id) ON DELETE CASCADE,
          period_no VARCHAR(50) NOT NULL,
          due_date DATE NOT NULL,
          amount DECIMAL(15, 2),
          status VARCHAR(50) DEFAULT 'PENDING',
          paid_date DATE,
          payment_ref VARCHAR(100),
          notes TEXT,
          alert_days INTEGER DEFAULT 10,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        -- 5. Create Contract Files Table
        CREATE TABLE IF NOT EXISTS contract_files (
          id SERIAL PRIMARY KEY,
          contract_id INTEGER REFERENCES contracts(id) ON DELETE CASCADE,
          file_name VARCHAR(255) NOT NULL,
          file_path VARCHAR(500) NOT NULL,
          file_size INTEGER,
          file_type VARCHAR(100),
          uploaded_by VARCHAR(100),
          uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          description TEXT
        );

        -- 6. Create User Activity Logs Table
        CREATE TABLE IF NOT EXISTS user_activity_logs (
          id SERIAL PRIMARY KEY,
          user_id INTEGER REFERENCES users(id),
          username VARCHAR(100),
          action_type VARCHAR(50) CHECK (action_type IN ('LOGIN', 'LOGOUT', 'VIEW', 'CREATE', 'UPDATE', 'DELETE', 'EXPORT', 'IMPORT', 'DELETE_FILE')),
          entity_type VARCHAR(50),
          entity_id INTEGER,
          entity_data JSONB,
          ip_address VARCHAR(45),
          user_agent TEXT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        -- 7. Create Alert Tracking Table
        CREATE TABLE IF NOT EXISTS alert_tracking (
          id SERIAL PRIMARY KEY,
          alert_type VARCHAR(50) NOT NULL,
          item_id INTEGER NOT NULL,
          email_address VARCHAR(255) NOT NULL,
          sent_date DATE NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          UNIQUE(alert_type, item_id, email_address, sent_date)
        );

        -- Create indexes for better performance
        CREATE INDEX IF NOT EXISTS idx_contracts_status ON contracts(status);
        CREATE INDEX IF NOT EXISTS idx_contracts_end_date ON contracts(end_date);
        CREATE INDEX IF NOT EXISTS idx_periods_due_date ON contract_periods(due_date);
        CREATE INDEX IF NOT EXISTS idx_periods_contract ON contract_periods(contract_id);
        CREATE INDEX IF NOT EXISTS idx_files_contract ON contract_files(contract_id);
        CREATE INDEX IF NOT EXISTS idx_activity_logs_user ON user_activity_logs(user_id);
        CREATE INDEX IF NOT EXISTS idx_alert_tracking_sent ON alert_tracking(sent_date);
      `;

      // Execute create tables
      await pool.query(createTablesSql);
      console.log('✅ All tables created successfully!\n');

      // Check if admin user exists
      const adminCheck = await pool.query("SELECT * FROM users WHERE username = 'admin'");
      if (adminCheck.rows.length === 0) {
        console.log('📝 Creating default admin user...');
        
        // Hash for password 'admin123' (you should change this)
        const bcrypt = require('bcryptjs');
        const hashedPassword = await bcrypt.hash('admin123', 10);
        
        await pool.query(`
          INSERT INTO users (username, password, email, role) 
          VALUES ('admin', $1, 'admin@contract.com', 'admin')
        `, [hashedPassword]);
        
        console.log('✅ Admin user created (username: admin, password: admin123)');
        console.log('⚠️ Please change the admin password immediately!\n');
      }

      // Create sample department if none exists
      const deptCheck = await pool.query("SELECT * FROM departments");
      if (deptCheck.rows.length === 0) {
        console.log('📝 Creating sample department...');
        await pool.query(`
          INSERT INTO departments (name, code, description) 
          VALUES ('ฝ่ายจัดซื้อ', 'PROC', 'ฝ่ายจัดซื้อและพัสดุ')
        `);
        console.log('✅ Sample department created\n');
      }

    } else {
      console.log('✅ All required tables exist!\n');
    }

    // Check data counts
    console.log('📊 Data Statistics:');
    const tables = ['users', 'departments', 'contracts', 'contract_periods', 'contract_files'];
    for (const table of tables) {
      try {
        const countResult = await pool.query(`SELECT COUNT(*) FROM ${table}`);
        console.log(`  ${table}: ${countResult.rows[0].count} records`);
      } catch (err) {
        console.log(`  ${table}: Table not found`);
      }
    }

    console.log('\n✅ Database check complete!');
    
    // Test alert system
    console.log('\n🔔 Testing Alert System...');
    const contractsNearExpiry = await pool.query(`
      SELECT COUNT(*) as count
      FROM contracts 
      WHERE status IN ('ACTIVE', 'PENDING', 'รอดำเนินการ')
      AND end_date <= CURRENT_DATE + INTERVAL '30 days'
    `);
    console.log(`  Contracts near expiry: ${contractsNearExpiry.rows[0].count}`);

    const periodsDue = await pool.query(`
      SELECT COUNT(*) as count
      FROM contract_periods p
      JOIN contracts c ON p.contract_id = c.id
      WHERE c.status IN ('ACTIVE', 'PENDING', 'รอดำเนินการ')
      AND p.status = 'PENDING'
      AND p.due_date <= CURRENT_DATE + INTERVAL '10 days'
    `);
    console.log(`  Periods due soon: ${periodsDue.rows[0].count}`);

  } catch (error) {
    console.error('❌ Database Error:', error.message);
    console.log('\n📋 Troubleshooting:');
    console.log('1. Check your .env file has correct database credentials');
    console.log('2. Ensure the database exists on Render');
    console.log('3. Check network connectivity');
  } finally {
    await pool.end();
  }

  console.log('\n========================================');
  console.log('📊 Database Check Complete');
  console.log('========================================\n');
}

// Run the check
checkAndCreateTables();
