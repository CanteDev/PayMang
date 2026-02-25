-- Migration: add pack_offers table
-- Version: 20260224
-- Description: Creates the pack_offers table to support multiple payment links/offers per pack from Hotmart or Stripe.

-- Create gateway_type enum if it doesn't exist (it should from 001_initial_schema.sql, but just in case we can skip as it's already there)

CREATE TABLE IF NOT EXISTS pack_offers (
   id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
   pack_id UUID NOT NULL REFERENCES packs(id) ON DELETE CASCADE,
   gateway gateway_type NOT NULL,
   external_id TEXT, -- e.g. Hotmart Offer ID or Stripe Price ID
   name TEXT NOT NULL,
   price DECIMAL(10, 2) NOT NULL,
   currency TEXT DEFAULT 'EUR',
   checkout_url TEXT NOT NULL,
   is_active BOOLEAN NOT NULL DEFAULT true,
   created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for querying offers by pack
CREATE INDEX IF NOT EXISTS idx_pack_offers_pack ON pack_offers(pack_id);
-- Index for querying offers by gateway
CREATE INDEX IF NOT EXISTS idx_pack_offers_gateway ON pack_offers(gateway);

-- Add updated_at trigger for pack_offers
ALTER TABLE pack_offers ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
CREATE TRIGGER update_pack_offers_updated_at BEFORE UPDATE ON pack_offers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Row Level Security
ALTER TABLE pack_offers ENABLE ROW LEVEL SECURITY;

-- Policies
-- Admin: CRUD
CREATE POLICY "pack_offers_all_admin" ON pack_offers
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Everyone can read active offers
CREATE POLICY "pack_offers_select_active" ON pack_offers
  FOR SELECT
  USING (is_active = true);

-- Add external_product_id to packs
ALTER TABLE packs ADD COLUMN IF NOT EXISTS external_product_id TEXT;
