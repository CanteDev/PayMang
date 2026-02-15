-- Migration: Cleanup Test Data
-- Description: Removes all transactional data to start fresh for testing. 
-- Preserves: profiles, packs, app_settings.

-- 1. Disable triggers temporarily if needed (optional but safer for bulk delete)
-- SET session_replication_role = 'replica';

-- 2. Truncate tables with CASCADE to handle all dependencies
-- This will clear: students, payments, commissions, sales, payment_links, notifications
TRUNCATE TABLE 
    notifications,
    payment_links,
    commissions,
    payments,
    sales,
    students 
CASCADE;

-- 3. Reset sequences if any (optional)
-- ALTER SEQUENCE IF EXISTS students_id_seq RESTART WITH 1;

-- 4. Re-enable triggers
-- SET session_replication_role = 'origin';

-- NOTE: Profiles (users) and Packs are PRESERVED.
