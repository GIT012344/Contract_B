-- เพิ่ม columns ที่จำเป็นสำหรับ contract_periods table
ALTER TABLE contract_periods 
ADD COLUMN IF NOT EXISTS description VARCHAR(500),
ADD COLUMN IF NOT EXISTS amount DECIMAL(15,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'รอดำเนินการ',
ADD COLUMN IF NOT EXISTS alert_days INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;

-- เพิ่ม trigger สำหรับ updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- สร้าง trigger สำหรับ contract_periods
DROP TRIGGER IF EXISTS update_contract_periods_updated_at ON contract_periods;
CREATE TRIGGER update_contract_periods_updated_at
    BEFORE UPDATE ON contract_periods
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- เพิ่ม index สำหรับการค้นหา
CREATE INDEX IF NOT EXISTS idx_contract_periods_contract_id ON contract_periods(contract_id);
CREATE INDEX IF NOT EXISTS idx_contract_periods_due_date ON contract_periods(due_date);
CREATE INDEX IF NOT EXISTS idx_contract_periods_status ON contract_periods(status);

-- อัพเดทข้อมูลเก่าที่ไม่มี description
UPDATE contract_periods 
SET description = CONCAT('งวดที่ ', period_no)
WHERE description IS NULL OR description = '';

-- Comment สำหรับ columns
COMMENT ON COLUMN contract_periods.description IS 'คำอธิบายงวดงาน';
COMMENT ON COLUMN contract_periods.amount IS 'จำนวนเงินของงวดงาน';
COMMENT ON COLUMN contract_periods.status IS 'สถานะงวดงาน: รอดำเนินการ, กำลังดำเนินการ, เสร็จสิ้น, รอส่งมอบ';
COMMENT ON COLUMN contract_periods.alert_days IS 'จำนวนวันก่อนครบกำหนดที่จะแจ้งเตือน';
