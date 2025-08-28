-- Add table for sharing contracts between departments
-- This allows admins to share specific contracts with other departments

CREATE TABLE IF NOT EXISTS contract_shares (
    id SERIAL PRIMARY KEY,
    contract_id INTEGER NOT NULL REFERENCES contracts(id) ON DELETE CASCADE,
    department_id INTEGER NOT NULL REFERENCES departments(id) ON DELETE CASCADE,
    shared_by INTEGER REFERENCES users(id),
    shared_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    can_edit BOOLEAN DEFAULT false,
    can_delete BOOLEAN DEFAULT false,
    notes TEXT,
    UNIQUE(contract_id, department_id)
);

-- Add index for faster queries
CREATE INDEX IF NOT EXISTS idx_contract_shares_department ON contract_shares(department_id);
CREATE INDEX IF NOT EXISTS idx_contract_shares_contract ON contract_shares(contract_id);

-- Add deleted_flag column to contracts if not exists
ALTER TABLE contracts 
ADD COLUMN IF NOT EXISTS deleted_flag BOOLEAN DEFAULT FALSE;

-- Sample query to share a contract with another department
-- INSERT INTO contract_shares (contract_id, department_id, shared_by, can_edit, can_delete)
-- VALUES (1, 2, 1, true, false);
