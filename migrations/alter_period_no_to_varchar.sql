-- Migration to change period_no from INTEGER to VARCHAR
-- This allows period codes like 'P1', 'งวด1', 'Phase-1' etc.

-- Step 1: Add new column
ALTER TABLE contract_periods 
ADD COLUMN period_no_new VARCHAR(50);

-- Step 2: Copy and convert existing data
UPDATE contract_periods 
SET period_no_new = CAST(period_no AS VARCHAR(50));

-- Step 3: Drop old constraint
ALTER TABLE contract_periods 
DROP CONSTRAINT IF EXISTS contract_periods_contract_id_period_no_key;

-- Step 4: Drop old column
ALTER TABLE contract_periods 
DROP COLUMN period_no;

-- Step 5: Rename new column to original name
ALTER TABLE contract_periods 
RENAME COLUMN period_no_new TO period_no;

-- Step 6: Add back unique constraint
ALTER TABLE contract_periods 
ADD CONSTRAINT contract_periods_contract_id_period_no_key 
UNIQUE(contract_id, period_no);

-- Step 7: Add NOT NULL constraint
ALTER TABLE contract_periods 
ALTER COLUMN period_no SET NOT NULL;

-- Step 8: Update any indexes
DROP INDEX IF EXISTS idx_contract_periods_period;
CREATE INDEX idx_contract_periods_period ON contract_periods(period_no);

COMMIT;
