-- เพิ่มตาราง user_activity_logs สำหรับเก็บ Log การใช้งาน
CREATE TABLE IF NOT EXISTS user_activity_logs (
  id SERIAL PRIMARY KEY,
  user_id INT REFERENCES users(id) ON DELETE SET NULL,
  username VARCHAR(100), -- เก็บไว้เผื่อ user ถูกลบ
  action_type VARCHAR(50) NOT NULL, -- LOGIN, LOGOUT, CREATE, UPDATE, DELETE, VIEW, EXPORT, etc.
  resource_type VARCHAR(50), -- CONTRACT, PERIOD, USER, SETTINGS, etc.
  resource_id INT, -- ID ของ resource ที่ถูกกระทำ
  description TEXT, -- รายละเอียดการกระทำ
  ip_address INET, -- IP Address ของผู้ใช้
  user_agent TEXT, -- Browser/Device ที่ใช้
  request_method VARCHAR(10), -- GET, POST, PUT, DELETE
  request_url VARCHAR(500), -- URL ที่เรียก
  status_code INT, -- HTTP Status Code (200, 404, 500, etc.)
  response_time_ms INT, -- เวลาในการประมวลผล (milliseconds)
  additional_data JSONB, -- ข้อมูลเพิ่มเติมในรูปแบบ JSON
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- สร้าง Index สำหรับการค้นหาที่เร็วขึ้น
CREATE INDEX IF NOT EXISTS idx_user_activity_logs_user_id ON user_activity_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_user_activity_logs_username ON user_activity_logs(username);
CREATE INDEX IF NOT EXISTS idx_user_activity_logs_action_type ON user_activity_logs(action_type);
CREATE INDEX IF NOT EXISTS idx_user_activity_logs_resource_type ON user_activity_logs(resource_type);
CREATE INDEX IF NOT EXISTS idx_user_activity_logs_created_at ON user_activity_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_user_activity_logs_ip_address ON user_activity_logs(ip_address);

-- เพิ่ม Constraint สำหรับ action_type ที่อนุญาต
ALTER TABLE user_activity_logs 
ADD CONSTRAINT IF NOT EXISTS action_type_check 
CHECK (action_type IN ('LOGIN', 'LOGOUT', 'REGISTER', 'CREATE', 'UPDATE', 'DELETE', 'VIEW', 'EXPORT', 'UPLOAD', 'DOWNLOAD', 'SEARCH', 'ERROR'));

-- เพิ่ม Constraint สำหรับ resource_type ที่อนุญาต
ALTER TABLE user_activity_logs 
ADD CONSTRAINT IF NOT EXISTS resource_type_check 
CHECK (resource_type IN ('USER', 'CONTRACT', 'PERIOD', 'FILE', 'SETTINGS', 'SYSTEM') OR resource_type IS NULL);

-- เพิ่ม Comment สำหรับตาราง
COMMENT ON TABLE user_activity_logs IS 'ตารางเก็บ Log การใช้งานของผู้ใช้ในระบบ';
COMMENT ON COLUMN user_activity_logs.action_type IS 'ประเภทการกระทำ เช่น LOGIN, CREATE, UPDATE, DELETE';
COMMENT ON COLUMN user_activity_logs.resource_type IS 'ประเภทของ Resource ที่ถูกกระทำ เช่น CONTRACT, PERIOD';
COMMENT ON COLUMN user_activity_logs.additional_data IS 'ข้อมูลเพิ่มเติมในรูปแบบ JSON สำหรับรายละเอียดเพิ่มเติม';
