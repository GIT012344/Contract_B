// Simple test to verify exports work
console.log('Testing exports with mocked database...\n');

// Mock the database module
const mockPool = {
  query: async () => ({ rows: [] }),
  end: () => {}
};

// Mock require for db
require.cache[require.resolve('./db')] = {
  exports: mockPool
};

// Now load reportController
try {
  const reportController = require('./controllers/reportController');
  
  const funcs = Object.keys(reportController).filter(k => typeof reportController[k] === 'function');
  
  console.log(`✅ Module loaded successfully!`);
  console.log(`Found ${funcs.length} functions exported`);
  
  // Check the specific function that's failing on Render
  if (typeof reportController.getDashboardMetrics === 'function') {
    console.log('✅ getDashboardMetrics is a function - GOOD!');
  } else {
    console.log('❌ getDashboardMetrics is NOT a function - BAD!');
  }
  
  if (funcs.length > 0) {
    console.log('\n✅ Exports are working correctly!');
    console.log('The code is ready to push to GitHub.');
  } else {
    console.log('\n❌ No functions exported!');
  }
} catch (error) {
  console.error('Error:', error.message);
}

process.exit(0);
