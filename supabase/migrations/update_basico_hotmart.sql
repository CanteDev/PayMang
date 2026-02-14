-- Update BASICO pack with Hotmart product and offer IDs
-- Product ID: 7192262
-- Offer ID: 77x3bqwm

-- First, let's see the current gateway_ids for BASICO pack
SELECT id, name, price, gateway_ids 
FROM packs 
WHERE LOWER(name) LIKE '%basic%' OR LOWER(name) LIKE '%básic%';

-- Update BASICO pack with Hotmart IDs
UPDATE packs 
SET gateway_ids = jsonb_set(
    COALESCE(gateway_ids, '{}'::jsonb),
    '{hotmart}',
    '{"product_id": "7192262", "offer_id": "77x3bqwm"}'::jsonb
)
WHERE LOWER(name) LIKE '%basic%' OR LOWER(name) LIKE '%básic%';

-- Verify the update
SELECT id, name, price, gateway_ids 
FROM packs 
WHERE LOWER(name) LIKE '%basic%' OR LOWER(name) LIKE '%básic%';
