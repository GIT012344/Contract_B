const express = require('express');
const app = express();
const PORT = process.env.PORT || 5005;
const cors = require('cors');
const activityLoggerMiddleware = require('./middlewares/activityLogger');
const authMiddleware = require('./middlewares/auth');

// CORS configuration
const corsOptions = {
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    
    const allowedOrigins = [
      'http://localhost:3000',
      'http://localhost:3010',
      'http://localhost:3003',
      'https://contract-f.onrender.com',
      'https://contract-management.netlify.app'
    ];
    
    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      callback(null, true); // Allow all origins in production for now
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
};

app.use(express.json());
app.use(cors(corsOptions));

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
const reportRoutes = require('./routes/reportRoutes');
const fileRoutes = require('./routes/fileRoutes');

// Apply routes
app.use('/api/auth', authRoutes);
app.use('/api/contracts', contractRoutes);
app.use('/api/activity-logs', activityLogRoutes);
app.use('/api/alerts', alertRoutes);
app.use('/api/departments', departmentRoutes);
app.use('/api/users', userRoutes);
app.use('/api/periods', periodsRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api', fileRoutes);

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
      CHECK (status IN ('CRTD', 'ACTIVE', 'EXPIRED', 'DELETED'))
    `);
    
    res.json({ success: true, message: 'Constraint updated successfully' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Initialize cron jobs
const cronJobService = require('./services/cronJobs');
cronJobService.initializeCronJobs();

// Test route
app.get('/', (req, res) => {
  res.send('Contract Management API is running');
});

if (process.env.NODE_ENV !== 'production' || process.env.ENABLE_TEST_ENDPOINTS === 'true') {
  // Test email sending
  app.get('/api/test-email', authMiddleware, async (req, res) => {
    try {
      const { sendMail } = require('./services/emailService');
      const testEmail = req.query.email || req.user.email;
      
      await sendMail({
        to: testEmail,
        subject: 'Test Email - Contract Management System',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #2563eb;">ทดสอบระบบส่งอีเมล</h2>
            <p>นี่คืออีเมลทดสอบจากระบบจัดการสัญญา</p>
            <p>ส่งเมื่อ: ${new Date().toLocaleString('th-TH')}</p>
            <p>ส่งโดย: ${req.user.username}</p>
            <hr />
            <p style="color: #6b7280; font-size: 12px;">
              หากได้รับอีเมลนี้ แสดงว่าระบบส่งอีเมลทำงานปกติ
            </p>
          </div>
        `
      });
      
      res.json({ 
        success: true, 
        message: `Test email sent to ${testEmail}` 
      });
    } catch (error) {
      console.error('Test email error:', error);
      res.status(500).json({ 
        success: false, 
        error: error.message 
      });
    }
  });

  // Test alert service
  app.get('/api/test-alerts', authMiddleware, async (req, res) => {
    try {
      const alertService = require('./services/alertService');
      const result = await alertService.runDailyAlerts();
      res.json({
        success: true,
        message: 'Alert check completed',
        result
      });
    } catch (error) {
      console.error('Test alerts error:', error);
      res.status(500).json({ 
        success: false, 
        error: error.message 
      });
    }
  });

  // Check email configuration
  app.get('/api/check-email-config', authMiddleware, async (req, res) => {
    try {
      const config = {
        EMAIL_HOST: process.env.EMAIL_HOST ? '✓ Configured' : '✗ Not set',
        EMAIL_USER: process.env.EMAIL_USER ? '✓ Configured' : '✗ Not set',
        EMAIL_PASSWORD: process.env.EMAIL_PASSWORD ? '✓ Configured' : '✗ Not set',
        EMAIL_FROM: process.env.EMAIL_FROM ? '✓ Configured' : '✗ Not set',
        ALERT_SCHEDULE: process.env.ALERT_SCHEDULE || '* * * * *',
        ALERT_CONTRACT_EXPIRY_DAYS: process.env.ALERT_CONTRACT_EXPIRY_DAYS || '7',
        ALERT_PERIOD_DUE_DAYS: process.env.ALERT_PERIOD_DUE_DAYS || '7'
      };
      
      res.json({
        success: true,
        configuration: config,
        emailReady: !!(process.env.EMAIL_USER && process.env.EMAIL_PASSWORD)
      });
    } catch (error) {
      res.status(500).json({ 
        success: false, 
        error: error.message 
      });
    }
  });
}

const server = app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM signal received: closing HTTP server');
  cronJobService.stopAllCronJobs();
  server.close(() => {
    console.log('HTTP server closed');
  });
});