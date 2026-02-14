-- Add Sequra tracking fields to sales table
ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS sequra_order_ref TEXT;
ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS sequra_payment_status JSONB DEFAULT '{"initial_70": false, "second_15": false, "final_15": false}'::jsonb;

-- Comment on columns
COMMENT ON COLUMN public.sales.sequra_order_ref IS 'Reference ID for Sequra order';
COMMENT ON COLUMN public.sales.sequra_payment_status IS 'Tracks the 70-15-15 payment milestones for Sequra';
