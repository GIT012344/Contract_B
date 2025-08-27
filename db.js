const { Pool } = require('pg');

// Detect if we need SSL - Render PostgreSQL always requires SSL
const dbHost = process.env.DB_HOST || '127.0.0.1';
const isRenderDB = dbHost.includes('render.com');
const isExternalDB = dbHost !== 'localhost' && dbHost !== '127.0.0.1';
const needsSSL = isRenderDB || isExternalDB;

console.log('Database connection config:', {
  host: dbHost,
  database: process.env.DB_NAME || 'postgres',
  ssl: needsSSL ? 'enabled (required for Render)' : 'disabled',
  environment: process.env.NODE_ENV || 'development'
});

const poolConfig = {
  host: dbHost,
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASS || '4321',
  database: process.env.DB_NAME || 'postgres',
  port: process.env.DB_PORT ? parseInt(process.env.DB_PORT) : 5432,
  max: 10,
  idleTimeoutMillis: 30000
};

// ALWAYS add SSL for Render databases and external databases
if (needsSSL) {
  poolConfig.ssl = {
    rejectUnauthorized: false
  };
  console.log('SSL enabled for database connection');
}

const pool = new Pool(poolConfig);

module.exports = pool;