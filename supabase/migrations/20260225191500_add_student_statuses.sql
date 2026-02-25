-- Migration: Add missing student statuses to ENUM
-- Description: Adds 'inactive' and 'paused' to the student_status ENUM so the database accepts them when updating from the UI.

ALTER TYPE student_status ADD VALUE IF NOT EXISTS 'inactive';
ALTER TYPE student_status ADD VALUE IF NOT EXISTS 'paused';
