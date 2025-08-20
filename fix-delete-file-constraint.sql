-- แก้ไข constraint สำหรับ action_type ให้รองรับ DELETE_FILE
ALTER TABLE user_activity_logs 
DROP CONSTRAINT IF EXISTS action_type_check;

ALTER TABLE user_activity_logs 
ADD CONSTRAINT action_type_check 
CHECK (action_type IN (
  'LOGIN', 'LOGOUT', 'REGISTER',
  'CREATE', 'UPDATE', 'DELETE', 'DELETE_FILE', 'VIEW', 'SEARCH',
  'EXPORT', 'UPLOAD', 'DOWNLOAD', 'ERROR'
));
