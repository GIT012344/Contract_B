const jwt = require('jsonwebtoken');
const SECRET = process.env.JWT_SECRET || 'contract_secret';

const authMiddleware = (req, res, next) => {
  // ตรวจสอบ token จาก header หรือ query string
  let token = req.header('Authorization')?.replace('Bearer ', '');
  
  // ถ้าไม่มี token ใน header ให้ตรวจสอบจาก query string
  if (!token && req.query.token) {
    token = req.query.token;
  }
  
  if (!token) {
    return res.status(401).json({ message: 'Access denied. No token provided.' });
  }
  
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
    req.user = decoded;
    next();
  } catch (error) {
    res.status(400).json({ message: 'Invalid token.' });
  }
};

module.exports = authMiddleware;