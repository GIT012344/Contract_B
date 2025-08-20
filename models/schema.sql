-- ตารางสัญญา
CREATE TABLE contracts (
  id SERIAL PRIMARY KEY,
  contract_no VARCHAR(100) NOT NULL,
  contract_date DATE,
  contact_name VARCHAR(255),
  department VARCHAR(100),
  start_date DATE,
  end_date DATE,
  period_count INT,
  remark1 TEXT,
  remark2 TEXT,
  remark3 TEXT,
  remark4 TEXT,
  alert_emails TEXT,
  status VARCHAR(10) DEFAULT 'CRTD', -- ENUM แนะนำใช้ VARCHAR + CHECK
  deleted_flag BOOLEAN DEFAULT FALSE,
  created_by VARCHAR(100),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_by VARCHAR(100),
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE contracts ADD CONSTRAINT status_check CHECK (status IN ('CRTD','ACTIVE','EXPIRE','DELETED'));

-- ตารางไฟล์แนบ
CREATE TABLE contract_files (
  id SERIAL PRIMARY KEY,
  contract_id INT REFERENCES contracts(id) ON DELETE CASCADE,
  filename VARCHAR(255),
  path VARCHAR(255),
  mimetype VARCHAR(100),
  uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ตารางงวดงาน
CREATE TABLE contract_periods (
  id SERIAL PRIMARY KEY,
  contract_id INT REFERENCES contracts(id) ON DELETE CASCADE,
  period_no INT,
  due_date DATE
);

-- ตารางผู้ใช้ (mock สำหรับ auth)
CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  username VARCHAR(100) UNIQUE,
  password VARCHAR(255),
  role VARCHAR(10) DEFAULT 'user',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE users ADD CONSTRAINT role_check CHECK (role IN ('admin','user'));

-- ตารางเก็บ Log การใช้งานของผู้ใช้
CREATE TABLE user_activity_logs (
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

-- สร้าง Index เพื่อเพิ่มประสิทธิภาพการค้นหา
CREATE INDEX idx_user_activity_logs_user_id ON user_activity_logs(user_id);
CREATE INDEX idx_user_activity_logs_action_type ON user_activity_logs(action_type);
CREATE INDEX idx_user_activity_logs_resource_type ON user_activity_logs(resource_type);
CREATE INDEX idx_user_activity_logs_created_at ON user_activity_logs(created_at);
CREATE INDEX idx_user_activity_logs_ip_address ON user_activity_logs(ip_address);

-- เพิ่ม Constraint สำหรับ action_type
ALTER TABLE user_activity_logs ADD CONSTRAINT action_type_check 
CHECK (action_type IN (
  'LOGIN', 'LOGOUT', 'REGISTER',
  'CREATE', 'UPDATE', 'DELETE', 'VIEW', 'SEARCH',
  'EXPORT', 'IMPORT', 'UPLOAD', 'DOWNLOAD',
  'SEND_EMAIL', 'GENERATE_REPORT',
  'CHANGE_PASSWORD', 'UPDATE_PROFILE',
  'ACCESS_DENIED', 'ERROR'
)); 