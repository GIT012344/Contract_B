const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const db = require('../db');
const ActivityLogger = require('../services/activityLogger');
const ldapService = require('../services/ldapService');
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
    
    // บันทึก Activity Log สำหรับการสมัครสมาชิก
    await ActivityLogger.logRegister(user, req);

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

// เข้าสู่ระบบ (Login) - รองรับ LDAP Authentication และ Local Authentication
exports.login = async (req, res) => {
  try {
    const { username, password } = req.body;
    
    if (!username || !password) {
      return res.status(400).json({ 
        error: 'กรุณากรอก username และ password' 
      });
    }

    let user = null;
    let authMethod = 'local';
    let ldapUserData = null;

    // ลองเข้าสู่ระบบผ่าน LDAP ก่อน
    try {
      console.log(`Attempting LDAP authentication for user: ${username}`);
      
      // ตรวจสอบการเชื่อมต่อ LDAP
      const isLdapConnected = await ldapService.testConnection();
      
      if (isLdapConnected) {
        // ทำการ authenticate ผ่าน LDAP
        const ldapAuth = await ldapService.authenticateUser(username, password);
        
        if (ldapAuth.success) {
          console.log('LDAP authentication successful');
          authMethod = 'ldap';
          ldapUserData = ldapAuth.user;
          
          // ค้นหาหรือสร้างผู้ใช้ในฐานข้อมูล local
          const existingUser = await db.query(
            'SELECT id, username, role, ldap_dn FROM users WHERE username = $1',
            [username]
          );
          
          if (existingUser.rows.length > 0) {
            // อัพเดทข้อมูลผู้ใช้ที่มีอยู่
            user = existingUser.rows[0];
            
            // อัพเดท role หากมีการเปลี่ยนแปลงจาก LDAP
            if (ldapUserData.role && user.role !== ldapUserData.role) {
              await db.query(
                'UPDATE users SET role = $1, ldap_dn = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $3',
                [ldapUserData.role, ldapUserData.dn, user.id]
              );
              user.role = ldapUserData.role;
            }
          } else {
            // สร้างผู้ใช้ใหม่จากข้อมูล LDAP
            const newUserResult = await db.query(
              'INSERT INTO users (username, password, role, ldap_dn, created_at) VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP) RETURNING id, username, role, ldap_dn',
              [username, '', ldapUserData.role || 'user', ldapUserData.dn]
            );
            user = newUserResult.rows[0];
            console.log(`Created new user from LDAP: ${username}`);
          }
        } else {
          console.log('LDAP authentication failed:', ldapAuth.error);
        }
      } else {
        console.log('LDAP server not available, falling back to local authentication');
      }
    } catch (ldapError) {
      console.error('LDAP authentication error:', ldapError.message);
      console.log('Falling back to local authentication');
    }

    // หาก LDAP authentication ไม่สำเร็จ ให้ใช้ local authentication
    if (!user) {
      console.log(`Attempting local authentication for user: ${username}`);
      
      const userResult = await db.query(
        'SELECT id, username, password, role FROM users WHERE username = $1',
        [username]
      );
      
      if (userResult.rows.length === 0) {
        return res.status(401).json({ 
          error: 'Username หรือ Password ไม่ถูกต้อง' 
        });
      }
      
      const localUser = userResult.rows[0];
      
      // ตรวจสอบว่ามี password ที่เข้ารหัสไว้หรือไม่ (สำหรับ local users)
      if (!localUser.password) {
        return res.status(401).json({ 
          error: 'บัญชีนี้ต้องเข้าสู่ระบบผ่าน LDAP เท่านั้น' 
        });
      }
      
      // ตรวจสอบ password
      const isPasswordValid = await bcrypt.compare(password, localUser.password);
      
      if (!isPasswordValid) {
        return res.status(401).json({ 
          error: 'Username หรือ Password ไม่ถูกต้อง' 
        });
      }
      
      user = localUser;
      authMethod = 'local';
      console.log('Local authentication successful');
    }
    
    // สร้าง JWT token
    const token = jwt.sign(
      { 
        id: user.id, 
        username: user.username, 
        role: user.role,
        authMethod: authMethod
      }, 
      SECRET, 
      { expiresIn: '8h' }
    );
    
    // บันทึก Activity Log สำหรับการเข้าสู่ระบบ
    await ActivityLogger.log({
      userId: user.id,
      username: user.username,
      actionType: 'LOGIN',
      description: `User logged in via ${authMethod.toUpperCase()}${ldapUserData ? ` (Groups: ${ldapUserData.groups?.join(', ') || 'None'})` : ''}`,
      ipAddress: req.ip || req.connection.remoteAddress,
      userAgent: req.get('User-Agent'),
      requestMethod: req.method,
      requestUrl: req.originalUrl,
      statusCode: 200,
      additionalData: {
        authMethod: authMethod,
        ldapGroups: ldapUserData?.groups || null,
        ldapDn: ldapUserData?.dn || null
      }
    });

    res.json({
      message: `เข้าสู่ระบบสำเร็จผ่าน ${authMethod === 'ldap' ? 'LDAP' : 'Local Account'}`,
      token,
      user: {
        id: user.id,
        username: user.username,
        role: user.role,
        authMethod: authMethod
      }
    });
    
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ 
      error: 'เกิดข้อผิดพลาดในการเข้าสู่ระบบ กรุณาลองใหม่อีกครั้ง' 
    });
  }
};

// ดูข้อมูลโปรไฟล์ผู้ใช้
exports.getProfile = async (req, res) => {
  try {
    const userId = req.user.id; // จาก JWT middleware
    
    const userResult = await db.query(
      'SELECT id, username, role, created_at FROM users WHERE id = $1',
      [userId]
    );
    
    if (userResult.rows.length === 0) {
      return res.status(404).json({ 
        error: 'ไม่พบข้อมูลผู้ใช้' 
      });
    }
    
    const user = userResult.rows[0];
    res.json({
      id: user.id,
      username: user.username,
      role: user.role,
      createdAt: user.created_at
    });
    
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({ 
      error: 'เกิดข้อผิดพลาดในการดึงข้อมูลผู้ใช้' 
    });
  }
};

// อัปเดตข้อมูลโปรไฟล์ผู้ใช้
exports.updateProfile = async (req, res) => {
  try {
    const userId = req.user.id;
    const { email, password, currentPassword } = req.body;
    
    // ดึงข้อมูลผู้ใช้ปัจจุบัน
    const userResult = await db.query(
      'SELECT id, username, password, email FROM users WHERE id = $1',
      [userId]
    );
    
    if (userResult.rows.length === 0) {
      return res.status(404).json({ 
        error: 'ไม่พบข้อมูลผู้ใช้' 
      });
    }
    
    const user = userResult.rows[0];
    const updates = [];
    const values = [];
    let paramCount = 1;
    
    // อัปเดตอีเมล
    if (email !== undefined && email !== user.email) {
      updates.push(`email = $${paramCount}`);
      values.push(email);
      paramCount++;
    }
    
    // อัปเดตรหัสผ่าน
    if (password) {
      // ตรวจสอบรหัสผ่านปัจจุบัน - ถ้าเปลี่ยนรหัสผ่านต้องใส่รหัสผ่านเดิม
      if (!currentPassword) {
        return res.status(400).json({ 
          error: 'กรุณากรอกรหัสผ่านปัจจุบัน',
          message: 'กรุณากรอกรหัสผ่านปัจจุบัน' 
        });
      }
      
      // ตรวจสอบว่ารหัสผ่านปัจจุบันถูกต้อง
      const isPasswordValid = await bcrypt.compare(currentPassword, user.password);
      if (!isPasswordValid) {
        return res.status(401).json({ 
          error: 'รหัสผ่านปัจจุบันไม่ถูกต้อง' 
        });
      }
      
      // ตรวจสอบความยาวรหัสผ่านใหม่
      if (password.length < 6) {
        return res.status(400).json({ 
          error: 'รหัสผ่านใหม่ต้องมีความยาวอย่างน้อย 6 ตัวอักษร' 
        });
      }
      
      // เข้ารหัสรหัสผ่านใหม่
      const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);
      updates.push(`password = $${paramCount}`);
      values.push(hashedPassword);
      paramCount++;
    }
    
    // ถ้าไม่มีอะไรต้องอัปเดต
    if (updates.length === 0) {
      return res.status(400).json({ 
        error: 'ไม่มีข้อมูลที่ต้องอัปเดต' 
      });
    }
    
    // อัปเดตฐานข้อมูล
    updates.push(`updated_at = CURRENT_TIMESTAMP`);
    values.push(userId);
    
    const updateQuery = `
      UPDATE users 
      SET ${updates.join(', ')} 
      WHERE id = $${paramCount}
      RETURNING id, username, email, role, updated_at
    `;
    
    const updatedUser = await db.query(updateQuery, values);
    
    // บันทึก Activity Log
    await ActivityLogger.log({
      userId: userId,
      username: req.user.username,
      actionType: 'UPDATE',
      resourceType: 'USER',
      resourceId: userId,
      description: `อัปเดตข้อมูลโปรไฟล์: ${updates.filter(u => !u.includes('updated_at')).join(', ')}`,
      ipAddress: req.ip || req.connection.remoteAddress,
      userAgent: req.get('User-Agent'),
      requestMethod: req.method,
      requestUrl: req.originalUrl,
      statusCode: 200
    });
    
    res.json({
      message: 'อัปเดตข้อมูลโปรไฟล์สำเร็จ',
      user: {
        id: updatedUser.rows[0].id,
        username: updatedUser.rows[0].username,
        email: updatedUser.rows[0].email,
        role: updatedUser.rows[0].role,
        updatedAt: updatedUser.rows[0].updated_at
      }
    });
    
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({ 
      error: 'เกิดข้อผิดพลาดในการอัปเดตข้อมูล' 
    });
  }
};

// ดูการตั้งค่าการแจ้งเตือน
exports.getNotificationSettings = async (req, res) => {
  try {
    // Mock settings - ในอนาคตอาจเก็บจากฐานข้อมูล
    res.json({
      emailNotifications: true,
      alertDays: 7,
      dailyReport: false,
      weeklyReport: true
    });
  } catch (error) {
    console.error('Get notification settings error:', error);
    res.status(500).json({ 
      error: 'เกิดข้อผิดพลาดในการดึงการตั้งค่าการแจ้งเตือน' 
    });
  }
};

// ดูการตั้งค่าระบบ
exports.getSystemSettings = async (req, res) => {
  try {
    // Mock settings - ในอนาคตอาจเก็บจากฐานข้อมูล
    res.json({
      systemName: 'ระบบจัดการสัญญา',
      version: '1.0.0',
      timezone: 'Asia/Bangkok',
      language: 'th',
      maintenanceMode: false
    });
  } catch (error) {
    console.error('Get system settings error:', error);
    res.status(500).json({ 
      error: 'เกิดข้อผิดพลาดในการดึงการตั้งค่าระบบ' 
    });
  }
};