// Test if db.js is causing the module loading issue
console.log('Testing db.js module...');

try {
  // First test pg module
  const { Pool } = require('pg');
  console.log('✓ pg module loaded');
  
  // Test creating a pool
  const testPool = new Pool({
    host: 'localhost',
    database: 'postgres',
    user: 'postgres',
    password: '4321',
    port: 5432
  });
  console.log('✓ Test pool created');
  
  // Now test our db.js
  console.log('\nLoading db.js...');
  const pool = require('./db.js');
  console.log('✓ db.js loaded');
  console.log('Pool type:', typeof pool);
  console.log('Pool.query:', typeof pool.query);
  
  // Now test if we can load reportController after db
  console.log('\nLoading reportController...');
  const reportController = require('./controllers/reportController.js');
  console.log('✓ reportController loaded');
  console.log('Exports:', Object.keys(reportController).length);
  
  process.exit(0);
  
} catch (error) {
  console.error('❌ Error:', error.message);
  console.error('Stack:', error.stack);
  process.exit(1);
}
