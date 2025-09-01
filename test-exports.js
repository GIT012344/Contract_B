// Test reportController exports
console.log('Testing reportController exports...');

// Mock the database connection first
const mockPool = {
  query: async () => ({ rows: [] })
};

// Override the db module before loading reportController
require.cache[require.resolve('./db.js')] = {
  exports: mockPool,
  filename: require.resolve('./db.js'),
  loaded: true
};

// Now load reportController
const reportController = require('./controllers/reportController.js');

console.log('\nExports found:');
console.log('- Total exports:', Object.keys(reportController).length);
console.log('- getDashboardMetrics:', typeof reportController.getDashboardMetrics);
console.log('- getContractSummary:', typeof reportController.getContractSummary);
console.log('- exportToExcel:', typeof reportController.exportToExcel);
console.log('- exportToPDF:', typeof reportController.exportToPDF);

const allFunctions = Object.keys(reportController).filter(k => typeof reportController[k] === 'function');
console.log('\nAll function exports:', allFunctions.length);
allFunctions.forEach(fn => console.log(`  - ${fn}`));
