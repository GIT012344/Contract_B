// Test server startup
const express = require('express');
const app = express();
const PORT = 5006; // Use different port for testing

console.log('Starting test server...');

// Try to load report routes
try {
  console.log('Loading report routes...');
  const reportRoutes = require('./routes/reportRoutes');
  
  console.log('Report routes loaded successfully');
  
  // Check if routes are valid
  app.use('/api/reports', reportRoutes);
  
  console.log('Routes mounted successfully');
  
  // Start server
  app.listen(PORT, () => {
    console.log(`Test server running on port ${PORT}`);
    console.log('Server started successfully! No route handler errors.');
    
    // Exit after successful start
    setTimeout(() => {
      console.log('Test completed successfully');
      process.exit(0);
    }, 1000);
  });
  
} catch (error) {
  console.error('ERROR loading routes:', error.message);
  if (error.message.includes('must be a function')) {
    console.error('>>> Route handler error found! The exports are not working properly.');
  }
  console.error('Stack:', error.stack);
  process.exit(1);
}
