-- Migration: add pack_offer_id to payment_links
-- Version: 20260224_2
-- Description: Adds pack_offer_id to payment_links to support specific offer selection (e.g. Hotmart Smart Installments vs Upfront).

ALTER TABLE payment_links ADD COLUMN IF NOT EXISTS pack_offer_id UUID REFERENCES pack_offers(id) ON DELETE SET NULL;
