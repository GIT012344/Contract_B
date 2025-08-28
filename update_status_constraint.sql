-- Drop existing constraint
ALTER TABLE contracts DROP CONSTRAINT IF EXISTS status_check;

-- Add constraint following status flow: CRTD -> ACTIVE -> EXPIRED with manual DELETED
ALTER TABLE contracts ADD CONSTRAINT status_check 
CHECK (status IN ('CRTD', 'ACTIVE', 'EXPIRED', 'DELETED'));

-- Update any existing EXPIRE to EXPIRED for consistency
UPDATE contracts SET status = 'EXPIRED' WHERE status = 'EXPIRE';

-- Update PENDING to ACTIVE
UPDATE contracts SET status = 'ACTIVE' WHERE status = 'PENDING';

-- Update COMPLETED to EXPIRED
UPDATE contracts SET status = 'EXPIRED' WHERE status = 'COMPLETED';

-- Update CANCELLED to DELETED
UPDATE contracts SET status = 'DELETED' WHERE status = 'CANCELLED';

-- Verify the change
SELECT conname, contype, pg_get_constraintdef(oid) 
FROM pg_constraint 
WHERE conname = 'status_check';
