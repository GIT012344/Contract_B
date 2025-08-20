-- เพิ่ม email column ในตาราง users ถ้ายังไม่มี
ALTER TABLE users ADD COLUMN IF NOT EXISTS email VARCHAR(255);
ALTER TABLE users ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP;
ALTER TABLE users ADD COLUMN IF NOT EXISTS ldap_dn VARCHAR(500);

-- แก้ไข constraint สำหรับ action_type ให้รองรับ DELETE_FILE
ALTER TABLE user_activity_logs 
DROP CONSTRAINT IF EXISTS action_type_check;

ALTER TABLE user_activity_logs 
ADD CONSTRAINT action_type_check 
CHECK (action_type IN (
  'LOGIN', 'LOGOUT', 'REGISTER',
  'CREATE', 'UPDATE', 'DELETE', 'DELETE_FILE', 'VIEW', 'SEARCH',
  'EXPORT', 'IMPORT', 'UPLOAD', 'DOWNLOAD',
  'SEND_EMAIL', 'GENERATE_REPORT',
  'CHANGE_PASSWORD', 'UPDATE_PROFILE',
  'ACCESS_DENIED', 'ERROR'
));
