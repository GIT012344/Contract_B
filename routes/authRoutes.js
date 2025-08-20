const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const db = require('../db');
const ldapService = require('../services/ldapService');

// Login with LDAP support and local fallback
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    // 1. Try LDAP authentication first
    const ldapResult = await ldapService.authenticateUser(username, password);
    
    if (ldapResult.success) {
      // LDAP authentication successful
      console.log('LDAP authentication successful for user:', username);
      
      // Check if user exists in local database
      const localUserResult = await db.query(
        'SELECT * FROM users WHERE username = $1',
        [username]
      );
      
      let userId;
      let userRole;
      let userDepartment;
      let userFullName;
      
      if (localUserResult.rows.length > 0) {
        // User exists, update their LDAP info
        const localUser = localUserResult.rows[0];
        userId = localUser.id;
        
        // Update user's LDAP info in database
        await db.query(
          `UPDATE users 
           SET ldap_dn = $1, 
               email = COALESCE($2, email),
               full_name = COALESCE($3, full_name),
               department = COALESCE($4, department),
               updated_at = CURRENT_TIMESTAMP
           WHERE id = $5`,
          [
            ldapResult.user.dn,
            ldapResult.user.email,
            ldapResult.user.displayName,
            ldapResult.user.department,
            userId
          ]
        );
        
        // Use role from database (can be overridden by admin)
        userRole = localUser.role;
        userDepartment = ldapResult.user.department || localUser.department;
        userFullName = ldapResult.user.displayName || localUser.full_name;
      } else {
        // Create new user from LDAP
        const createUserResult = await db.query(
          `INSERT INTO users (username, password, full_name, email, role, department, ldap_dn, created_at, updated_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
           RETURNING *`,
          [
            username,
            'LDAP_AUTH', // No local password for LDAP users
            ldapResult.user.displayName,
            ldapResult.user.email,
            ldapResult.user.role,
            ldapResult.user.department,
            ldapResult.user.dn
          ]
        );
        
        const newUser = createUserResult.rows[0];
        userId = newUser.id;
        userRole = newUser.role;
        userDepartment = newUser.department;
        userFullName = newUser.full_name;
      }
      
      // Create token
      const token = jwt.sign(
        { id: userId, username: username, role: userRole },
        process.env.JWT_SECRET || 'your_jwt_secret',
        { expiresIn: '24h' }
      );
      
      return res.json({
        token,
        user: {
          id: userId,
          username: username,
          full_name: userFullName,
          role: userRole,
          department: userDepartment,
          auth_method: 'ldap'
        }
      });
    }
    
    // 2. LDAP failed or not configured, try local authentication
    console.log('Attempting local authentication for user:', username);
    
    const result = await db.query(
      'SELECT * FROM users WHERE username = $1',
      [username]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    const user = result.rows[0];
    
    // Skip password check for LDAP-only users
    if (user.password === 'LDAP_AUTH') {
      return res.status(401).json({ message: 'Please use LDAP authentication' });
    }

    // Check password
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    // Create token
    const token = jwt.sign(
      { id: user.id, username: user.username, role: user.role },
      process.env.JWT_SECRET || 'your_jwt_secret',
      { expiresIn: '24h' }
    );

    res.json({
      token,
      user: {
        id: user.id,
        username: user.username,
        full_name: user.full_name,
        role: user.role,
        department: user.department,
        auth_method: 'local'
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Verify token
router.get('/verify', async (req, res) => {
  const token = req.headers.authorization?.split(' ')[1];

  if (!token) {
    return res.status(401).json({ message: 'No token provided' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your_jwt_secret');
    res.json({ valid: true, user: decoded });
  } catch (error) {
    res.status(401).json({ valid: false, message: 'Invalid token' });
  }
});

module.exports = router;
