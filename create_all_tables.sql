-- สร้าง Database
CREATE DATABASE IF NOT EXISTS contract_db;

-- ใช้ Database
\c contract_db;

-- 1. ตาราง users
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    full_name VARCHAR(100),
    email VARCHAR(100),
    phone VARCHAR(20),
    department VARCHAR(50),
    position VARCHAR(50),
    role VARCHAR(20) DEFAULT 'user',
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. ตาราง contracts
CREATE TABLE IF NOT EXISTS contracts (
    id SERIAL PRIMARY KEY,
    contract_no VARCHAR(100) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    vendor VARCHAR(255),
    description TEXT,
    department VARCHAR(100),
    amount DECIMAL(15,2),
    start_date DATE,
    end_date DATE,
    status VARCHAR(20) DEFAULT 'CRTD',
    contract_type VARCHAR(50),
    payment_type VARCHAR(50),
    contact_name VARCHAR(100),
    contact_phone VARCHAR(20),
    contact_email VARCHAR(100),
    alert_days INTEGER DEFAULT 30,
    alert_emails TEXT,
    parent_contract_id INTEGER REFERENCES contracts(id),
    created_by INTEGER REFERENCES users(id),
    updated_by INTEGER REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT status_check CHECK (status IN ('CRTD', 'ACTIVE', 'EXPIRED', 'EXPIRE', 'DELETED', 'COMPLETED', 'CANCELLED', 'PENDING'))
);

-- 3. ตาราง contract_files
CREATE TABLE IF NOT EXISTS contract_files (
    id SERIAL PRIMARY KEY,
    contract_id INTEGER REFERENCES contracts(id) ON DELETE CASCADE,
    file_name VARCHAR(255) NOT NULL,
    file_path TEXT NOT NULL,
    file_size BIGINT,
    file_type VARCHAR(50),
    uploaded_by INTEGER REFERENCES users(id),
    uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 4. ตาราง contract_periods
CREATE TABLE IF NOT EXISTS contract_periods (
    id SERIAL PRIMARY KEY,
    contract_id INTEGER REFERENCES contracts(id) ON DELETE CASCADE,
    period_no INTEGER NOT NULL,
    description TEXT,
    amount DECIMAL(15,2),
    due_date DATE,
    status VARCHAR(50) DEFAULT 'รอดำเนินการ',
    payment_date DATE,
    invoice_no VARCHAR(100),
    receipt_no VARCHAR(100),
    notes TEXT,
    created_by INTEGER REFERENCES users(id),
    updated_by INTEGER REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 5. ตาราง user_activity_logs
CREATE TABLE IF NOT EXISTS user_activity_logs (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    action VARCHAR(50) NOT NULL,
    resource_type VARCHAR(50),
    resource_id INTEGER,
    details JSONB,
    ip_address VARCHAR(45),
    user_agent TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 6. ตาราง notifications
CREATE TABLE IF NOT EXISTS notifications (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    type VARCHAR(50),
    title VARCHAR(255),
    message TEXT,
    related_type VARCHAR(50),
    related_id INTEGER,
    is_read BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 7. ตาราง settings
CREATE TABLE IF NOT EXISTS settings (
    id SERIAL PRIMARY KEY,
    key VARCHAR(100) UNIQUE NOT NULL,
    value TEXT,
    description TEXT,
    updated_by INTEGER REFERENCES users(id),
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 8. ตาราง departments
CREATE TABLE IF NOT EXISTS departments (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) UNIQUE NOT NULL,
    description TEXT,
    manager_id INTEGER REFERENCES users(id),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- สร้าง Indexes
CREATE INDEX idx_contracts_status ON contracts(status);
CREATE INDEX idx_contracts_department ON contracts(department);
CREATE INDEX idx_contracts_dates ON contracts(start_date, end_date);
CREATE INDEX idx_periods_contract ON contract_periods(contract_id);
CREATE INDEX idx_periods_status ON contract_periods(status);
CREATE INDEX idx_periods_due_date ON contract_periods(due_date);
CREATE INDEX idx_logs_user ON user_activity_logs(user_id);
CREATE INDEX idx_logs_created ON user_activity_logs(created_at);
CREATE INDEX idx_notifications_user ON notifications(user_id);
CREATE INDEX idx_notifications_read ON notifications(is_read);

-- สร้าง Default Admin User (password: admin123)
INSERT INTO users (username, password, full_name, email, role, department, position) 
VALUES (
    'admin', 
    '$2a$10$YourHashedPasswordHere', -- ใช้ bcrypt hash ของ 'admin123'
    'System Administrator',
    'admin@company.com',
    'admin',
    'IT',
    'System Admin'
) ON CONFLICT (username) DO NOTHING;

-- สร้าง Sample Data
INSERT INTO departments (name, description) VALUES
    ('IT', 'Information Technology'),
    ('HR', 'Human Resources'),
    ('Finance', 'Finance Department'),
    ('Operations', 'Operations Department'),
    ('Sales', 'Sales Department')
ON CONFLICT DO NOTHING;

-- Function สำหรับ Update Timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers สำหรับ Auto Update Timestamp
CREATE TRIGGER update_contracts_updated_at BEFORE UPDATE ON contracts
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_contract_periods_updated_at BEFORE UPDATE ON contract_periods
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Grant Permissions (ปรับตาม user ที่ใช้)
-- GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO your_app_user;
-- GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO your_app_user;

-- View สำหรับดู Contract Summary
CREATE OR REPLACE VIEW contract_summary AS
SELECT 
    c.id,
    c.contract_no,
    c.name,
    c.vendor,
    c.department,
    c.amount,
    c.status,
    c.start_date,
    c.end_date,
    COUNT(cp.id) as total_periods,
    COUNT(CASE WHEN cp.status = 'เสร็จสิ้น' OR cp.status = 'completed' THEN 1 END) as completed_periods,
    COUNT(CASE WHEN cp.status IN ('รอดำเนินการ', 'กำลังดำเนินการ', 'รอส่งมอบ') THEN 1 END) as pending_periods
FROM contracts c
LEFT JOIN contract_periods cp ON c.id = cp.contract_id
GROUP BY c.id;
