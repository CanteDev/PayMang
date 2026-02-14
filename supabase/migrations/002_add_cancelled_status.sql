-- Add 'cancelled' status to commission_status enum
ALTER TYPE commission_status ADD VALUE IF NOT EXISTS 'cancelled';
