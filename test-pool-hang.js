// Test if pool creation is hanging
const { Pool } = require('pg');

console.log('Creating pool with timeout...');

const pool = new Pool({
  host: '127.0.0.1',
  user: 'postgres',
  password: '4321',
  database: 'postgres',
  port: 5432,
  connectionTimeoutMillis: 2000, // 2 second timeout
  idleTimeoutMillis: 1000,
  max: 1
});

console.log('Pool created');

// Test with a simple query
pool.query('SELECT 1', (err, result) => {
  if (err) {
    console.error('Query error:', err.message);
  } else {
    console.log('Query success');
  }
  
  // End pool
  pool.end(() => {
    console.log('Pool ended');
    process.exit(0);
  });
});

// Force exit after 5 seconds if hanging
setTimeout(() => {
  console.log('Timeout - forcing exit');
  process.exit(1);
}, 5000);
