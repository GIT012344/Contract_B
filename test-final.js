// Final test - check if server can start without errors
const express = require('express');
const cors = require('cors');
const app = express();

app.use(express.json());
app.use(cors());

console.log('Starting final test...');

// Test loading each route
const routes = [
  { path: '/api/reports', file: './routes/reportRoutes' },
  { path: '/api/contracts', file: './routes/contractRoutes' },
  { path: '/api/auth', file: './routes/authRoutes' }
];

let allRoutesLoaded = true;

for (const route of routes) {
  try {
    console.log(`Loading ${route.file}...`);
    const routeModule = require(route.file);
    app.use(route.path, routeModule);
    console.log(`✓ ${route.file} loaded successfully`);
  } catch (error) {
    console.error(`✗ Error loading ${route.file}: ${error.message}`);
    if (error.message.includes('must be a function')) {
      console.error('  -> Route handler function export error!');
    }
    allRoutesLoaded = false;
  }
}

if (allRoutesLoaded) {
  console.log('\n✅ ALL ROUTES LOADED SUCCESSFULLY!');
  console.log('Backend can be deployed without route handler errors.');
  
  // Start server to confirm
  const PORT = 5008;
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log('Server started without errors!');
    
    // Exit after 2 seconds
    setTimeout(() => {
      console.log('\nTest completed successfully!');
      process.exit(0);
    }, 2000);
  });
} else {
  console.error('\n❌ ROUTE LOADING FAILED');
  console.error('Fix the export issues before deploying.');
  process.exit(1);
}
