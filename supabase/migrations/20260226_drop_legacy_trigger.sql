-- Drop the legacy trigger and function that was created in 20260215130000_refactor_payments.sql
-- These referenced columns (payment_method, agreed_price, etc.) that have been moved to the `sales` table
-- The new architecture creates payments via the app code, NOT via database triggers

DROP TRIGGER IF EXISTS trigger_create_installments ON students;
DROP FUNCTION IF EXISTS create_installments_for_student() CASCADE;
