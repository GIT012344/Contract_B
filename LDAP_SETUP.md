# LDAP Authentication Setup Guide

## การติดตั้งและตั้งค่า LDAP Authentication

### 1. ติดตั้ง Dependencies
```bash
npm install ldapjs ldap-authentication
```

### 2. เพิ่ม Column ในฐานข้อมูล
รันคำสั่ง SQL ต่อไปนี้ในฐานข้อมูล PostgreSQL:

```sql
-- เพิ่ม column สำหรับ LDAP authentication
ALTER TABLE users ADD COLUMN IF NOT EXISTS ldap_dn VARCHAR(500);

-- เพิ่ม index สำหรับ ldap_dn
CREATE INDEX IF NOT EXISTS idx_users_ldap_dn ON users(ldap_dn);

-- อัพเดท comment ของตาราง
COMMENT ON COLUMN users.ldap_dn IS 'LDAP Distinguished Name for LDAP authenticated users';
```

### 3. ตั้งค่า Environment Variables

สร้างไฟล์ `.env` และเพิ่มการตั้งค่า LDAP:

```env
# LDAP Configuration
LDAP_URL=ldap://your-ldap-server:389
LDAP_USER_DN=ou=users,dc=company,dc=com
LDAP_SEARCH_BASE=ou=users,dc=company,dc=com
LDAP_USERNAME_ATTR=uid
LDAP_ADMIN_DN=cn=admin,dc=company,dc=com
LDAP_ADMIN_PASSWORD=admin_password
```

#### สำหรับ Active Directory:
```env
LDAP_URL=ldap://ad.company.com:389
LDAP_USER_DN=cn=users,dc=company,dc=com
LDAP_SEARCH_BASE=cn=users,dc=company,dc=com
LDAP_USERNAME_ATTR=sAMAccountName
LDAP_ADMIN_DN=cn=admin,cn=users,dc=company,dc=com
LDAP_ADMIN_PASSWORD=admin_password
```

### 4. การทำงานของ LDAP Authentication

#### Authentication Flow:
1. **LDAP First**: ระบบจะลองเข้าสู่ระบบผ่าน LDAP ก่อน
2. **Local Fallback**: หาก LDAP ไม่สำเร็จ จะใช้ Local Authentication
3. **Auto User Creation**: หากผู้ใช้ LDAP ยังไม่มีในระบบ จะสร้างอัตโนมัติ
4. **Role Sync**: Role จะถูกอัพเดทจาก LDAP Groups

#### LDAP Group to Role Mapping:
- `CN=Admins,OU=Groups,DC=company,DC=com` → `admin`
- `CN=Managers,OU=Groups,DC=company,DC=com` → `manager`  
- `CN=Users,OU=Groups,DC=company,DC=com` → `user`
- Default → `user`

### 5. การทดสอบ

#### ทดสอบการเชื่อมต่อ LDAP:
```javascript
const ldapService = require('./services/ldapService');

async function testLDAP() {
  const isConnected = await ldapService.testConnection();
  console.log('LDAP Connection:', isConnected ? 'Success' : 'Failed');
  
  if (isConnected) {
    const auth = await ldapService.authenticateUser('testuser', 'password');
    console.log('Authentication:', auth);
  }
}

testLDAP();
```

#### ทดสอบ Login API:
```bash
curl -X POST http://localhost:3000/api/users/login \
  -H "Content-Type: application/json" \
  -d '{
    "username": "your_ldap_username",
    "password": "your_ldap_password"
  }'
```

### 6. Troubleshooting

#### ปัญหาที่พบบ่อย:

1. **LDAP Connection Failed**
   - ตรวจสอบ LDAP_URL และ port
   - ตรวจสอบ firewall และ network connectivity
   - ทดสอบด้วย `ldapsearch` หรือ LDAP client tools

2. **Authentication Failed**
   - ตรวจสอบ username format (uid vs sAMAccountName)
   - ตรวจสอบ LDAP_SEARCH_BASE
   - ตรวจสอบ admin credentials

3. **Role Mapping Issues**
   - ตรวจสอบ Group DN ใน `ldapService.js`
   - ตรวจสอบว่าผู้ใช้เป็นสมาชิกของ Groups ที่ถูกต้อง

#### Log Messages:
- `Attempting LDAP authentication for user: username`
- `LDAP authentication successful`
- `LDAP authentication failed: error_message`
- `Falling back to local authentication`
- `Local authentication successful`

### 7. Security Considerations

1. **LDAP over SSL/TLS**: ใช้ `ldaps://` สำหรับ production
2. **Admin Credentials**: เก็บ LDAP admin password ในที่ปลอดภัย
3. **Connection Timeout**: ตั้งค่า timeout สำหรับ LDAP connections
4. **Error Handling**: ไม่เปิดเผยข้อมูลละเอียดของ LDAP errors

### 8. การ Monitoring

Activity Logs จะบันทึก:
- Authentication method ที่ใช้ (LDAP/Local)
- LDAP Groups ของผู้ใช้
- LDAP DN
- IP Address และ User Agent
- Timestamp และ Response Time

ตรวจสอบ logs ได้ที่: `/api/activity-logs` (สำหรับ admin เท่านั้น)
