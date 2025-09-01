// Test reportController loading
console.log('Testing reportController...');

// Set environment to avoid database connection issues
process.env.DB_HOST = 'localhost';
process.env.NODE_ENV = 'test';

// Clear require cache
delete require.cache[require.resolve('./controllers/reportController.js')];
delete require.cache[require.resolve('./db.js')];

// Try to load the controller
try {
  console.log('Loading reportController...');
  const reportController = require('./controllers/reportController.js');
  
  console.log('Module loaded!');
  console.log('Type of module:', typeof reportController);
  console.log('Keys found:', Object.keys(reportController));
  
  // Check specific functions
  const expectedFunctions = [
    'getDashboardMetrics',
    'getContractSummary', 
    'exportToExcel',
    'exportToPDF'
  ];
  
  for (const fn of expectedFunctions) {
    if (reportController[fn]) {
      console.log(`✓ ${fn}: ${typeof reportController[fn]}`);
    } else {
      console.log(`✗ ${fn}: NOT FOUND`);
    }
  }
  
  // Test if we can call the function
  if (reportController.getDashboardMetrics) {
    console.log('\nTesting getDashboardMetrics function...');
    const mockReq = { query: {} };
    const mockRes = {
      json: (data) => console.log('Response would send:', Object.keys(data)),
      status: (code) => ({ json: (data) => console.log('Error response:', code, data) })
    };
    
    // This will fail due to DB but at least proves the function exists
    reportController.getDashboardMetrics(mockReq, mockRes);
  }
  
} catch (error) {
  console.error('Failed to load reportController:');
  console.error('Error:', error.message);
  console.error('Stack:', error.stack);
}
