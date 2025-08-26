require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const cron = require('node-cron');
const alertJob = require('./services/alertJob');

const app = express();
const PORT = process.env.PORT || 5005;

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  }
}));

// Compression middleware
app.use(compression());

// Rate limiting
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15 minutes
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});

// Apply rate limiting to all routes
app.use('/api/', limiter);

// Strict rate limiting for auth routes
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // limit each IP to 5 requests per windowMs
  skipSuccessfulRequests: true,
});

app.use('/api/users/login', authLimiter);
app.use('/api/users/register', authLimiter);

// Body parser middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// CORS configuration
const corsOptions = {
  origin: function (origin, callback) {
    const allowedOrigins = process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(',') : ['http://localhost:3003'];
    if (!origin || allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  optionsSuccessStatus: 200,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  exposedHeaders: ['X-Total-Count']
};

app.use(cors(corsOptions));

// Request logging middleware (for development)
if (process.env.NODE_ENV === 'development') {
  app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
    next();
  });
}

// Activity Logger Middleware (uncomment when ready)
// const activityLoggerMiddleware = require('./middlewares/activityLogger');
// app.use(activityLoggerMiddleware);

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development'
  });
});

// API Routes
const contractRoutes = require('./routes/contractRoutes');
const periodRoutes = require('./routes/periodRoutes');
const userRoutes = require('./routes/userRoutes');
const periodsRoutes = require('./routes/periodsRoutes');
const settingsRoutes = require('./routes/settingsRoutes');
const activityLogRoutes = require('./routes/activityLogRoutes');

app.use('/api/contracts', contractRoutes);
app.use('/api/contracts', periodRoutes);
app.use('/api/users', userRoutes);
app.use('/api/periods', periodsRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/activity-logs', activityLogRoutes);

// Cron job for alerts - รันทุก 8 โมงเช้า
// สำหรับทดสอบ: เปลี่ยนเป็น '* * * * *' (ทุกนาที)
// สำหรับ production: ใช้ '0 8 * * *' (8 โมงเช้าทุกวัน)
const ALERT_SCHEDULE = process.env.ALERT_SCHEDULE || '* * * * *';

cron.schedule(ALERT_SCHEDULE, () => {
  console.log(`[${new Date().toISOString()}] Running alert job...`);
  alertJob.runAlertJob();
}, {
  timezone: 'Asia/Bangkok'
});

console.log(`✅ Alert job scheduled: ${ALERT_SCHEDULE} (Asia/Bangkok timezone)`);

// Test route
app.get('/', (req, res) => {
  res.send('Contract Management API is running');
});

// 404 handler
app.use((req, res, next) => {
  res.status(404).json({
    error: 'Route not found',
    path: req.path,
    method: req.method
  });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('Error:', err);
  
  // Don't leak error details in production
  if (process.env.NODE_ENV === 'production') {
    res.status(err.status || 500).json({
      error: 'Internal server error',
      message: err.message || 'Something went wrong'
    });
  } else {
    res.status(err.status || 500).json({
      error: err.message || 'Internal server error',
      stack: err.stack,
      details: err
    });
  }
});

// Graceful shutdown
const server = app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`CORS enabled for: ${process.env.CORS_ORIGIN || 'http://localhost:3003'}`);
});

// Handle server shutdown gracefully
process.on('SIGTERM', () => {
  console.log('SIGTERM signal received: closing HTTP server');
  server.close(() => {
    console.log('HTTP server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('SIGINT signal received: closing HTTP server');
  server.close(() => {
    console.log('HTTP server closed');
    process.exit(0);
  });
});

module.exports = app;
