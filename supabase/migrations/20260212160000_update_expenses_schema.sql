-- Rename date to start_date
ALTER TABLE public.expenses RENAME COLUMN date TO start_date;

-- Add end_date column
ALTER TABLE public.expenses ADD COLUMN end_date DATE;

-- Comment on columns for clarity
COMMENT ON COLUMN public.expenses.start_date IS 'Date when the expense occurred or started (if recurring)';
COMMENT ON COLUMN public.expenses.end_date IS 'Date when the recurring expense ends (inclusive). If NULL and recurring is true, it is indefinite.';
