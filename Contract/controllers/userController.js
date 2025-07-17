const jwt = require('jsonwebtoken');
const SECRET = process.env.JWT_SECRET || 'contract_secret';

// MOCK: สมมติ login ผ่านเสมอ (ถ้า username, password ไม่ว่าง)
exports.login = (req, res) => {
  const { username, password, role } = req.body;
  if (!username || !password) return res.status(400).json({ error: 'Username and password required' });
  // TODO: เชื่อมต่อ LDAP จริง
  // ถ้า success:
  const user = { username, role: role === 'admin' ? 'admin' : 'user' };
  const token = jwt.sign(user, SECRET, { expiresIn: '8h' });
  res.json({ token, user });
}; 