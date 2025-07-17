const fs = require('fs');
const path = require('path');
const config = require('../config/config');

const logFile = path.join(config.LOG_PATH, 'contract.log');

function log(action, contractId, user, detail) {
  const entry = {
    timestamp: new Date().toISOString(),
    action,
    contractId,
    user: user || 'system',
    detail
  };
  const line = JSON.stringify(entry) + '\n';
  fs.appendFile(logFile, line, err => {
    if (err) console.error('Log error:', err);
  });
}

module.exports = { log }; 