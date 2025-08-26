const { Pool } = require('pg');

const pool = new Pool({
  host: process.env.DB_HOST || '127.0.0.1',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASS || '4321',
  database: process.env.DB_NAME || 'postgres',
  port: process.env.DB_PORT ? parseInt(process.env.DB_PORT) : 5432,
  max: 10,
  idleTimeoutMillis: 30000,
  // SSL configuration for production (Render requires SSL)
  ssl: process.env.NODE_ENV === 'production' 
    ? { rejectUnauthorized: false }
    : false
});

module.exports = pool;