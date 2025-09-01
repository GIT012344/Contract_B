// Direct test of reportController
console.log('Direct test starting...');

// Mock the db module before requiring reportController
const Module = require('module');
const originalRequire = Module.prototype.require;

Module.prototype.require = function(id) {
  if (id === '../db' || id === './db' || id.endsWith('/db')) {
    console.log('Mocking db.js...');
    return {
      query: async (sql, params) => {
        console.log('Mock query called');
        return { rows: [] };
      }
    };
  }
  return originalRequire.apply(this, arguments);
};

// Now load reportController
try {
  console.log('Loading reportController with mocked db...');
  const reportController = require('./controllers/reportController.js');
  
  console.log('\n✅ SUCCESS! reportController loaded');
  console.log('Type:', typeof reportController);
  console.log('Total exports:', Object.keys(reportController).length);
  
  const functions = Object.keys(reportController).filter(k => typeof reportController[k] === 'function');
  console.log('Functions found:', functions.length);
  
  // List first 5 functions
  console.log('\nFirst 5 functions:');
  functions.slice(0, 5).forEach(fn => {
    console.log(`  - ${fn}: ${typeof reportController[fn]}`);
  });
  
  // Check critical functions
  const critical = ['getDashboardMetrics', 'exportToExcel', 'exportToPDF'];
  console.log('\nCritical functions check:');
  critical.forEach(fn => {
    if (reportController[fn]) {
      console.log(`  ✓ ${fn} exists`);
    } else {
      console.log(`  ✗ ${fn} MISSING`);
    }
  });
  
} catch (error) {
  console.error('\n❌ FAILED to load reportController');
  console.error('Error:', error.message);
  console.error('Stack:', error.stack);
}
