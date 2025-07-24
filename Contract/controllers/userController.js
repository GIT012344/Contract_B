const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const db = require('../db');
const SECRET = process.env.JWT_SECRET || 'contract_secret';
const SALT_ROUNDS = 10;

// สมัครสมาชิก (Registration)
exports.register = async (req, res) => {
  try {
    const { username, password, role } = req.body;
    
    // ตรวจสอบข้อมูลที่จำเป็น
    if (!username || !password) {
      return res.status(400).json({ 
        error: 'กรุณากรอก username และ password' 
      });
    }
    
    // ตรวจสอบความยาวของ password
    if (password.length < 6) {
      return res.status(400).json({ 
        error: 'Password ต้องมีความยาวอย่างน้อย 6 ตัวอักษร' 
      });
    }
    
    // ตรวจสอบว่า username ซ้ำหรือไม่
    const existingUser = await db.query(
      'SELECT id FROM users WHERE username = $1', 
      [username]
    );
    
    if (existingUser.rows.length > 0) {
      return res.status(409).json({ 
        error: 'Username นี้มีผู้ใช้แล้ว กรุณาเลือก username อื่น' 
      });
    }
    
    // เข้ารหัส password
    const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);
    
    // บันทึกผู้ใช้ใหม่ลงฐานข้อมูล
    const newUser = await db.query(
      'INSERT INTO users (username, password, role) VALUES ($1, $2, $3) RETURNING id, username, role, created_at',
      [username, hashedPassword, role || 'user']
    );
    
    const user = newUser.rows[0];
    
    // สร้าง JWT token
    const token = jwt.sign(
      { id: user.id, username: user.username, role: user.role }, 
      SECRET, 
      { expiresIn: '8h' }
    );
    
    res.status(201).json({
      message: 'สมัครสมาชิกสำเร็จ',
      token,
      user: {
        id: user.id,
        username: user.username,
        role: user.role,
        createdAt: user.created_at
      }
    });
    
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ 
      error: 'เกิดข้อผิดพลาดในการสมัครสมาชิก กรุณาลองใหม่อีกครั้ง' 
    });
  }
};

// เข้าสู่ระบบ (Login) - ปรับปรุงให้ใช้ฐานข้อมูลจริง
exports.login = async (req, res) => {
  try {
    const { username, password } = req.body;
    
    if (!username || !password) {
      return res.status(400).json({ 
        error: 'กรุณากรอก username และ password' 
      });
    }
    
    // ค้นหาผู้ใช้ในฐานข้อมูล
    const userResult = await db.query(
      'SELECT id, username, password, role FROM users WHERE username = $1',
      [username]
    );
    
    if (userResult.rows.length === 0) {
      return res.status(401).json({ 
        error: 'Username หรือ Password ไม่ถูกต้อง' 
      });
    }
    
    const user = userResult.rows[0];
    
    // ตรวจสอบ password
    const isPasswordValid = await bcrypt.compare(password, user.password);
    
    if (!isPasswordValid) {
      return res.status(401).json({ 
        error: 'Username หรือ Password ไม่ถูกต้อง' 
      });
    }
    
    // สร้าง JWT token
    const token = jwt.sign(
      { id: user.id, username: user.username, role: user.role }, 
      SECRET, 
      { expiresIn: '8h' }
    );
    
    res.json({
      message: 'เข้าสู่ระบบสำเร็จ',
      token,
      user: {
        id: user.id,
        username: user.username,
        role: user.role
      }
    });
    
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ 
      error: 'เกิดข้อผิดพลาดในการเข้าสู่ระบบ กรุณาลองใหม่อีกครั้ง' 
    });
  }
};