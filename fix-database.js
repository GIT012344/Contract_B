const { Client } = require('pg');

const client = new Client({
  host: '127.0.0.1',
  port: 5432,
  user: 'postgres',
  password: '4321',
  database: 'postgres'
});

client.connect()
  .then(async () => {
    console.log('Connected to database');
    await client.query(`
      ALTER TABLE user_activity_logs 
      DROP CONSTRAINT IF EXISTS action_type_check
    `);
    
    await client.query(`
      ALTER TABLE user_activity_logs 
      ADD CONSTRAINT action_type_check 
      CHECK (action_type IN (
        'LOGIN', 'LOGOUT', 'REGISTER',
        'CREATE', 'UPDATE', 'DELETE', 'DELETE_FILE', 'VIEW', 'SEARCH',
        'EXPORT', 'UPLOAD', 'DOWNLOAD', 'ERROR'
      ))
    `);
  })
  .then(() => {
    console.log('✅ Successfully added new constraint with action types');
    return client.end();
  })
  .catch(err => {
    console.error('Error:', err.message);
    client.end();
  });
