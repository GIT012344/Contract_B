const express = require('express');
const app = express();
const PORT = process.env.PORT || 5005;
const cors = require('cors');
const activityLoggerMiddleware = require('./middlewares/activityLogger');

app.use(express.json());
app.use(cors());

// เพิ่ม Activity Logger Middleware (ต้องอยู่หลัง express.json และ cors)
// app.use(activityLoggerMiddleware); // ปิดชั่วคราว

// Routes
const authRoutes = require('./routes/authRoutes');
const contractRoutes = require('./routes/contractRoutes');
const periodRoutes = require('./routes/periodRoutes');
const activityLogRoutes = require('./routes/activityLogRoutes');
const alertRoutes = require('./routes/alertRoutes');
const departmentRoutes = require('./routes/departmentRoutes');
const userRoutes = require('./routes/userRoutes');
const periodsRoutes = require('./routes/periodsRoutes');
const settingsRoutes = require('./routes/settingsRoutes');

// Apply routes
app.use('/api/auth', authRoutes);
app.use('/api/contracts', contractRoutes);
app.use('/api/activity-logs', activityLogRoutes);
app.use('/api/alerts', alertRoutes);
app.use('/api/departments', departmentRoutes);
app.use('/api/users', userRoutes);
app.use('/api/periods', periodsRoutes);
app.use('/api/settings', settingsRoutes);

// Fix database constraint endpoint (temporary)
app.get('/api/fix-constraint', async (req, res) => {
  const db = require('./db');
  try {
    // Drop old constraint
    await db.query('ALTER TABLE contracts DROP CONSTRAINT IF EXISTS status_check');
    
    // Add new constraint with COMPLETED and CANCELLED
    await db.query(`
      ALTER TABLE contracts 
      ADD CONSTRAINT status_check 
      CHECK (status IN ('CRTD', 'ACTIVE', 'EXPIRED', 'DELETED', 'COMPLETED', 'CANCELLED', 'PENDING'))
    `);
    
    res.json({ success: true, message: 'Constraint updated successfully' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Initialize cron jobs
const cronJobs = require('./services/cronJobs');
cronJobs.initializeCronJobs();

// Test route
app.get('/', (req, res) => {
  res.send('Contract Management API is running');
});

const server = app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM signal received: closing HTTP server');
  cronJobs.stopAllCronJobs();
  server.close(() => {
    console.log('HTTP server closed');
  });
});