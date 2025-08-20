-- เพิ่ม column alert_days ในตาราง contract_periods
ALTER TABLE contract_periods 
ADD COLUMN IF NOT EXISTS alert_days INTEGER DEFAULT 7;

-- แสดงโครงสร้างตารางหลังเพิ่ม column
\d contract_periods;
