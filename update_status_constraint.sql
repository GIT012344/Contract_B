-- Drop existing constraint
ALTER TABLE contracts DROP CONSTRAINT IF EXISTS status_check;

-- Add new constraint with COMPLETED and CANCELLED
ALTER TABLE contracts ADD CONSTRAINT status_check 
CHECK (status IN ('CRTD', 'ACTIVE', 'EXPIRED', 'DELETED', 'COMPLETED', 'CANCELLED', 'PENDING'));

-- Update any existing EXPIRE to EXPIRED for consistency
UPDATE contracts SET status = 'EXPIRED' WHERE status = 'EXPIRE';

-- Verify the change
SELECT conname, contype, pg_get_constraintdef(oid) 
FROM pg_constraint 
WHERE conname = 'status_check';
