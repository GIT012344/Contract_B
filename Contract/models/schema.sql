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