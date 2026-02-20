-- Migration: Update packs to use direct payment links instead of product/offer IDs
-- Version: 20260220
-- Description: Adds commission percentages and migrates gateway_ids to use direct links

-- Add commission percentage columns to packs table
ALTER TABLE packs
  ADD COLUMN IF NOT EXISTS commission_closer DECIMAL(5,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS commission_coach  DECIMAL(5,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS commission_setter DECIMAL(5,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS description TEXT;

-- gateway_ids JSONB column is already flexible, so we just document new structure:
-- {
--   "hotmart_link": "https://pay.hotmart.com/XXXX",
--   "stripe_link":  "https://buy.stripe.com/XXXX",
--   "sequra_link":  "https://..."
-- }
-- Old keys (hotmart_prod_id, hotmart_offer_id, stripe_prod_id, sequra_merchant_id)
-- are deprecated and will be ignored by the app. Existing data is kept for reference.

-- Update existing packs that have hotmart_prod_id to hint they need links
-- (No destructive change, just adding a migration marker)
COMMENT ON COLUMN packs.gateway_ids IS 'Payment gateway links: { hotmart_link, stripe_link, sequra_link }';
COMMENT ON COLUMN packs.commission_closer IS 'Commission percentage for closer role (e.g. 10 = 10%)';
COMMENT ON COLUMN packs.commission_coach  IS 'Commission percentage for coach role (e.g. 5 = 5%)';
COMMENT ON COLUMN packs.commission_setter IS 'Commission percentage for setter role (e.g. 3 = 3%)';
