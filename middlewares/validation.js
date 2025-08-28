const { body, param, query, validationResult } = require('express-validator');

// Validation error handler
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      error: 'Validation Error',
      details: errors.array()
    });
  }
  next();
};

// Contract validations
const contractValidations = {
  create: [
    body('contractNo')
      .notEmpty().withMessage('Contract number is required')
      .isLength({ min: 3, max: 50 }).withMessage('Contract number must be between 3-50 characters')
      .trim()
      .escape(),
    body('contractDate')
      .optional()
      .isISO8601().withMessage('Invalid contract date format'),
    body('contactName')
      .optional()
      .isLength({ max: 100 }).withMessage('Contact name must be less than 100 characters')
      .trim()
      .escape(),
    body('department')
      .optional()
      .isLength({ max: 100 }).withMessage('Department must be less than 100 characters')
      .trim()
      .escape(),
    body('startDate')
      .optional()
      .isISO8601().withMessage('Invalid start date format'),
    body('endDate')
      .optional()
      .isISO8601().withMessage('Invalid end date format')
      .custom((value, { req }) => {
        if (req.body.startDate && value) {
          if (new Date(value) < new Date(req.body.startDate)) {
            throw new Error('End date must be after start date');
          }
        }
        return true;
      }),
    body('periodCount')
      .optional()
      .isInt({ min: 0, max: 999 }).withMessage('Period count must be between 0-999'),
    body('alertEmails')
      .optional()
      .custom((value) => {
        if (value) {
          const emails = value.split(',').map(e => e.trim());
          const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
          for (const email of emails) {
            if (!emailRegex.test(email)) {
              throw new Error(`Invalid email: ${email}`);
            }
          }
        }
        return true;
      }),
    body('status')
      .optional()
      .isIn(['CRTD', 'ACTIVE', 'EXPIRED', 'DELETED']).withMessage('Invalid status value'),
    handleValidationErrors
  ],

  update: [
    param('id').isInt().withMessage('Invalid contract ID'),
    ...contractValidations.create.slice(0, -1), // Reuse create validations except handler
    handleValidationErrors
  ],

  getById: [
    param('id').isInt().withMessage('Invalid contract ID'),
    handleValidationErrors
  ],

  search: [
    query('q')
      .optional()
      .isLength({ max: 100 }).withMessage('Search query too long')
      .trim()
      .escape(),
    query('status')
      .optional()
      .isIn(['CRTD', 'ACTIVE', 'EXPIRED', 'DELETED']).withMessage('Invalid status filter'),
    query('department')
      .optional()
      .isLength({ max: 100 }).withMessage('Department filter too long')
      .trim()
      .escape(),
    query('startDate')
      .optional()
      .isISO8601().withMessage('Invalid start date format'),
    query('endDate')
      .optional()
      .isISO8601().withMessage('Invalid end date format'),
    query('page')
      .optional()
      .isInt({ min: 1 }).withMessage('Page must be positive integer'),
    query('limit')
      .optional()
      .isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1-100'),
    handleValidationErrors
  ]
};

// User validations
const userValidations = {
  login: [
    body('username')
      .notEmpty().withMessage('Username is required')
      .isLength({ min: 3, max: 50 }).withMessage('Username must be between 3-50 characters')
      .trim()
      .escape(),
    body('password')
      .notEmpty().withMessage('Password is required')
      .isLength({ min: 4, max: 100 }).withMessage('Password must be between 4-100 characters'),
    handleValidationErrors
  ],

  register: [
    body('username')
      .notEmpty().withMessage('Username is required')
      .isLength({ min: 3, max: 50 }).withMessage('Username must be between 3-50 characters')
      .matches(/^[a-zA-Z0-9_-]+$/).withMessage('Username can only contain letters, numbers, underscore and dash')
      .trim(),
    body('password')
      .notEmpty().withMessage('Password is required')
      .isLength({ min: 8 }).withMessage('Password must be at least 8 characters')
      .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/).withMessage('Password must contain at least one uppercase, one lowercase, and one number'),
    body('email')
      .optional()
      .isEmail().withMessage('Invalid email format')
      .normalizeEmail(),
    body('role')
      .optional()
      .isIn(['admin', 'user', 'viewer']).withMessage('Invalid role'),
    handleValidationErrors
  ],

  update: [
    param('id').isInt().withMessage('Invalid user ID'),
    body('email')
      .optional()
      .isEmail().withMessage('Invalid email format')
      .normalizeEmail(),
    body('role')
      .optional()
      .isIn(['admin', 'user', 'viewer']).withMessage('Invalid role'),
    body('department')
      .optional()
      .isLength({ max: 100 }).withMessage('Department must be less than 100 characters')
      .trim()
      .escape(),
    handleValidationErrors
  ]
};

// Period validations
const periodValidations = {
  create: [
    body('contractId')
      .notEmpty().withMessage('Contract ID is required')
      .isInt().withMessage('Contract ID must be a number'),
    body('periodNo')
      .notEmpty().withMessage('Period number is required')
      .isInt({ min: 1 }).withMessage('Period number must be positive'),
    body('periodDate')
      .optional()
      .isISO8601().withMessage('Invalid period date format'),
    body('amount')
      .optional()
      .isFloat({ min: 0 }).withMessage('Amount must be positive number'),
    body('status')
      .optional()
      .isIn(['CRTD', 'ACTIVE', 'EXPIRED', 'DELETED']).withMessage('Invalid status value'),
    handleValidationErrors
  ],

  update: [
    param('id').isInt().withMessage('Invalid period ID'),
    ...periodValidations.create.slice(0, -1),
    handleValidationErrors
  ]
};

// File upload validation
const fileValidations = {
  upload: [
    param('id').isInt().withMessage('Invalid contract ID'),
    body('files')
      .custom((value, { req }) => {
        if (!req.files || req.files.length === 0) {
          throw new Error('No files uploaded');
        }
        
        const allowedTypes = process.env.ALLOWED_FILE_TYPES?.split(',') || 
          ['.pdf', '.doc', '.docx', '.xls', '.xlsx', '.png', '.jpg', '.jpeg'];
        const maxFileSize = parseInt(process.env.MAX_FILE_SIZE) || 10485760; // 10MB
        
        for (const file of req.files) {
          // Check file extension
          const ext = '.' + file.originalname.split('.').pop().toLowerCase();
          if (!allowedTypes.includes(ext)) {
            throw new Error(`File type ${ext} not allowed`);
          }
          
          // Check file size
          if (file.size > maxFileSize) {
            throw new Error(`File ${file.originalname} exceeds maximum size of ${maxFileSize} bytes`);
          }
        }
        return true;
      }),
    handleValidationErrors
  ]
};

// Activity log validations
const activityLogValidations = {
  query: [
    query('userId')
      .optional()
      .isInt().withMessage('Invalid user ID'),
    query('actionType')
      .optional()
      .isIn(['CREATE', 'UPDATE', 'DELETE', 'VIEW', 'LOGIN', 'LOGOUT', 'EXPORT', 'IMPORT'])
      .withMessage('Invalid action type'),
    query('resourceType')
      .optional()
      .isIn(['CONTRACT', 'PERIOD', 'USER', 'FILE', 'SETTINGS'])
      .withMessage('Invalid resource type'),
    query('startDate')
      .optional()
      .isISO8601().withMessage('Invalid start date format'),
    query('endDate')
      .optional()
      .isISO8601().withMessage('Invalid end date format'),
    query('page')
      .optional()
      .isInt({ min: 1 }).withMessage('Page must be positive integer'),
    query('limit')
      .optional()
      .isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1-100'),
    handleValidationErrors
  ]
};

// Export all validations
module.exports = {
  contractValidations,
  userValidations,
  periodValidations,
  fileValidations,
  activityLogValidations,
  handleValidationErrors
};
