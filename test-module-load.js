// Test if reportController can load completely
console.log('Testing module load...\n');

// Override require to intercept db.js
const Module = require('module');
const originalRequire = Module.prototype.require;

let dbRequested = false;
Module.prototype.require = function(id) {
  if (id === '../db' || id === './db' || id.endsWith('/db')) {
    dbRequested = true;
    console.log('✓ Database module intercepted and mocked');
    return {
      query: async () => ({ rows: [] }),
      end: () => {}
    };
  }
  return originalRequire.apply(this, arguments);
};

try {
  // Clear cache first
  delete require.cache[require.resolve('./controllers/reportController.js')];
  
  console.log('Loading reportController.js...');
  const reportController = require('./controllers/reportController.js');
  
  console.log('✓ Module loaded successfully!\n');
  
  // Check exports
  const exports = Object.keys(reportController);
  console.log(`Found ${exports.length} exports\n`);
  
  // Check specific function that's failing on Render
  if (reportController.getDashboardMetrics) {
    console.log('✓ getDashboardMetrics is exported and is a', typeof reportController.getDashboardMetrics);
  } else {
    console.log('✗ getDashboardMetrics is NOT exported!');
  }
  
  // List all exports
  console.log('\nAll exports:');
  exports.forEach(exp => {
    const type = typeof reportController[exp];
    console.log(`  ${exp}: ${type}`);
  });
  
  if (exports.length === 0) {
    console.log('\n❌ NO EXPORTS FOUND! The module is not exporting anything.');
    console.log('This will cause "handler must be a function" error on Render.');
  } else if (exports.length > 15) {
    console.log('\n✅ Exports look good! Module should work on Render.');
  }
  
} catch (error) {
  console.error('❌ Failed to load module:', error.message);
  console.error('Stack:', error.stack);
}

process.exit(0);
