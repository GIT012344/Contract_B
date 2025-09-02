-- สร้างตาราง contract_files สำหรับเก็บข้อมูลไฟล์ที่อัปโหลด
CREATE TABLE IF NOT EXISTS contract_files (
  id INT AUTO_INCREMENT PRIMARY KEY,
  contract_id INT NOT NULL,
  file_name VARCHAR(255) NOT NULL,
  file_path VARCHAR(500) NOT NULL,
  file_size INT NOT NULL,
  file_type VARCHAR(100),
  uploaded_by INT,
  uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  deleted_at TIMESTAMP NULL,
  FOREIGN KEY (contract_id) REFERENCES contracts(id) ON DELETE CASCADE,
  FOREIGN KEY (uploaded_by) REFERENCES users(id) ON DELETE SET NULL,
  INDEX idx_contract_id (contract_id),
  INDEX idx_deleted_at (deleted_at)
);
