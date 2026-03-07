-- Migration: Add commission rates to sales
-- Description: Adds closer, coach, and setter commission override columns to the sales table.

BEGIN;

ALTER TABLE public.sales
  ADD COLUMN IF NOT EXISTS commission_closer NUMERIC(5,4) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS commission_coach  NUMERIC(5,4) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS commission_setter NUMERIC(5,4) DEFAULT NULL;

COMMIT;
