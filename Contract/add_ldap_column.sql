-- เพิ่ม column สำหรับ LDAP authentication
ALTER TABLE users ADD COLUMN IF NOT EXISTS ldap_dn VARCHAR(500);

-- เพิ่ม index สำหรับ ldap_dn
CREATE INDEX IF NOT EXISTS idx_users_ldap_dn ON users(ldap_dn);

-- อัพเดท comment ของตาราง
COMMENT ON COLUMN users.ldap_dn IS 'LDAP Distinguished Name for LDAP authenticated users';
