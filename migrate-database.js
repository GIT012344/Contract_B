/**
 * Script to migrate data from old database to new database
 * Use this if you need to transfer data between databases
 */

require('dotenv').config();
const { Pool } = require('pg');

// Old database configuration
const oldPool = new Pool({
  host: 'dpg-d2mhh20gjchc73cl92h0-a.singapore-postgres.render.com',
  user: 'git',
  password: 'qEjnGB2aeibSxh9D5jYUDCtlrxtQDKb9',
  database: 'datagit_ra1a',
  port: 5432,
  ssl: {
    rejectUnauthorized: false
  }
});

// New database configuration (from .env)
const newPool = new Pool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME,
  port: process.env.DB_PORT || 5432,
  ssl: {
    rejectUnauthorized: false
  }
});

async function migrateData() {
  console.log('\n========================================');
  console.log('🔄 Database Migration Tool');
  console.log('========================================\n');
  
  console.log('📋 Migration Setup:');
  console.log('FROM (Old DB):');
  console.log('  Host: dpg-d2mhh20gjchc73cl92h0-a...');
  console.log('  Database: datagit_ra1a');
  console.log('  User: git\n');
  
  console.log('TO (New DB):');
  console.log('  Host:', process.env.DB_HOST);
  console.log('  Database:', process.env.DB_NAME);
  console.log('  User:', process.env.DB_USER);
  console.log('');

  const readlineSync = require('readline').createInterface({
    input: process.stdin,
    output: process.stdout
  });

  // Ask for confirmation
  await new Promise((resolve) => {
    readlineSync.question('⚠️ Do you want to migrate data? (yes/no): ', (answer) => {
      if (answer.toLowerCase() !== 'yes') {
        console.log('Migration cancelled.');
        process.exit(0);
      }
      readlineSync.close();
      resolve();
    });
  });

  try {
    // Test connections
    console.log('\n🔌 Testing connections...');
    
    try {
      await oldPool.query('SELECT NOW()');
      console.log('✅ Old database connected');
    } catch (err) {
      console.log('❌ Cannot connect to old database');
      console.log('   The old database might not exist anymore');
      console.log('   Skipping migration...\n');
      return;
    }

    await newPool.query('SELECT NOW()');
    console.log('✅ New database connected\n');

    // Check what data exists in old DB
    console.log('📊 Checking old database...');
    const tables = ['users', 'departments', 'contracts', 'contract_periods', 'contract_files'];
    const dataToMigrate = {};
    
    for (const table of tables) {
      try {
        const result = await oldPool.query(`SELECT COUNT(*) FROM ${table}`);
        const count = parseInt(result.rows[0].count);
        dataToMigrate[table] = count;
        console.log(`  ${table}: ${count} records`);
      } catch (err) {
        console.log(`  ${table}: Not found`);
        dataToMigrate[table] = 0;
      }
    }

    // If no data in old DB, skip
    const totalRecords = Object.values(dataToMigrate).reduce((a, b) => a + b, 0);
    if (totalRecords === 0) {
      console.log('\n⚠️ No data found in old database. Nothing to migrate.');
      return;
    }

    console.log(`\n📦 Total records to migrate: ${totalRecords}`);
    console.log('\n🚀 Starting migration...\n');

    // Migrate each table
    // 1. Departments
    if (dataToMigrate.departments > 0) {
      console.log('📋 Migrating departments...');
      const depts = await oldPool.query('SELECT * FROM departments');
      
      for (const dept of depts.rows) {
        try {
          await newPool.query(`
            INSERT INTO departments (id, name, code, description, created_at)
            VALUES ($1, $2, $3, $4, $5)
            ON CONFLICT (code) DO UPDATE
            SET name = EXCLUDED.name,
                description = EXCLUDED.description
          `, [dept.id, dept.name, dept.code, dept.description, dept.created_at]);
        } catch (err) {
          console.log(`  ⚠️ Error migrating department ${dept.code}: ${err.message}`);
        }
      }
      console.log(`  ✅ Migrated ${depts.rows.length} departments`);
    }

    // 2. Users
    if (dataToMigrate.users > 0) {
      console.log('📋 Migrating users...');
      const users = await oldPool.query('SELECT * FROM users');
      
      for (const user of users.rows) {
        try {
          await newPool.query(`
            INSERT INTO users (id, username, password, email, role, is_active, department_id, ldap_dn, created_at, updated_at)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
            ON CONFLICT (username) DO UPDATE
            SET email = EXCLUDED.email,
                role = EXCLUDED.role,
                is_active = EXCLUDED.is_active
          `, [user.id, user.username, user.password, user.email, user.role, 
              user.is_active, user.department_id, user.ldap_dn, user.created_at, user.updated_at]);
        } catch (err) {
          console.log(`  ⚠️ Error migrating user ${user.username}: ${err.message}`);
        }
      }
      console.log(`  ✅ Migrated ${users.rows.length} users`);
    }

    // 3. Contracts
    if (dataToMigrate.contracts > 0) {
      console.log('📋 Migrating contracts...');
      const contracts = await oldPool.query('SELECT * FROM contracts');
      
      for (const contract of contracts.rows) {
        try {
          await newPool.query(`
            INSERT INTO contracts (
              id, contract_no, contract_name, vendor_name, department_id, 
              contract_type, start_date, end_date, amount, period_count,
              payment_terms, contact_name, contact_email, contact_phone,
              status, alert_days, alert_emails, description, created_by,
              created_at, updated_at
            ) VALUES (
              $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 
              $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21
            )
            ON CONFLICT (contract_no) DO UPDATE
            SET contract_name = EXCLUDED.contract_name,
                vendor_name = EXCLUDED.vendor_name,
                status = EXCLUDED.status,
                updated_at = EXCLUDED.updated_at
          `, [
            contract.id, contract.contract_no, contract.contract_name,
            contract.vendor_name, contract.department_id, contract.contract_type,
            contract.start_date, contract.end_date, contract.amount,
            contract.period_count, contract.payment_terms, contract.contact_name,
            contract.contact_email, contract.contact_phone, contract.status,
            contract.alert_days, contract.alert_emails, contract.description,
            contract.created_by, contract.created_at, contract.updated_at
          ]);
        } catch (err) {
          console.log(`  ⚠️ Error migrating contract ${contract.contract_no}: ${err.message}`);
        }
      }
      console.log(`  ✅ Migrated ${contracts.rows.length} contracts`);
    }

    // 4. Contract Periods
    if (dataToMigrate.contract_periods > 0) {
      console.log('📋 Migrating contract periods...');
      const periods = await oldPool.query('SELECT * FROM contract_periods');
      
      for (const period of periods.rows) {
        try {
          await newPool.query(`
            INSERT INTO contract_periods (
              id, contract_id, period_no, due_date, amount,
              status, paid_date, payment_ref, notes, alert_days,
              created_at, updated_at
            ) VALUES (
              $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12
            )
            ON CONFLICT (id) DO UPDATE
            SET status = EXCLUDED.status,
                paid_date = EXCLUDED.paid_date,
                updated_at = EXCLUDED.updated_at
          `, [
            period.id, period.contract_id, period.period_no,
            period.due_date, period.amount, period.status,
            period.paid_date, period.payment_ref, period.notes,
            period.alert_days, period.created_at, period.updated_at
          ]);
        } catch (err) {
          console.log(`  ⚠️ Error migrating period: ${err.message}`);
        }
      }
      console.log(`  ✅ Migrated ${periods.rows.length} periods`);
    }

    // 5. Contract Files
    if (dataToMigrate.contract_files > 0) {
      console.log('📋 Migrating contract files...');
      const files = await oldPool.query('SELECT * FROM contract_files');
      
      for (const file of files.rows) {
        try {
          await newPool.query(`
            INSERT INTO contract_files (
              id, contract_id, file_name, file_path, file_size,
              file_type, uploaded_by, uploaded_at, description
            ) VALUES (
              $1, $2, $3, $4, $5, $6, $7, $8, $9
            )
            ON CONFLICT (id) DO NOTHING
          `, [
            file.id, file.contract_id, file.file_name, file.file_path,
            file.file_size, file.file_type, file.uploaded_by,
            file.uploaded_at, file.description
          ]);
        } catch (err) {
          console.log(`  ⚠️ Error migrating file: ${err.message}`);
        }
      }
      console.log(`  ✅ Migrated ${files.rows.length} files`);
    }

    // Reset sequences
    console.log('\n🔧 Resetting sequences...');
    const sequences = [
      'users_id_seq',
      'departments_id_seq',
      'contracts_id_seq',
      'contract_periods_id_seq',
      'contract_files_id_seq'
    ];

    for (const seq of sequences) {
      try {
        const table = seq.replace('_id_seq', '');
        await newPool.query(`
          SELECT setval('${seq}', (SELECT MAX(id) FROM ${table}))
        `);
      } catch (err) {
        // Ignore if sequence doesn't exist
      }
    }

    console.log('✅ Sequences reset\n');
    console.log('✅ Migration completed successfully!');

  } catch (error) {
    console.error('❌ Migration Error:', error.message);
    console.log('\n📋 Error Details:', error);
  } finally {
    await oldPool.end();
    await newPool.end();
  }

  console.log('\n========================================');
  console.log('🔄 Migration Complete');
  console.log('========================================\n');
}

// Run migration
migrateData();
