-- สร้างตาราง user_activity_logs
CREATE TABLE user_activity_logs (
  id SERIAL PRIMARY KEY,
  user_id INT,
  username VARCHAR(100),
  action_type VARCHAR(50) NOT NULL,
  resource_type VARCHAR(50),
  resource_id INT,
  description TEXT,
  ip_address VARCHAR(45),
  user_agent TEXT,
  request_method VARCHAR(10),
  request_url VARCHAR(500),
  status_code INT,
  response_time_ms INT,
  additional_data TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- สร้าง Index
CREATE INDEX idx_user_activity_logs_user_id ON user_activity_logs(user_id);
CREATE INDEX idx_user_activity_logs_username ON user_activity_logs(username);
CREATE INDEX idx_user_activity_logs_action_type ON user_activity_logs(action_type);
CREATE INDEX idx_user_activity_logs_created_at ON user_activity_logs(created_at);
