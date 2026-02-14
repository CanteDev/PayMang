-- Update BASICO pack with correct Hotmart Product Code
-- Product Code: L104393461L (was 7192262)
-- Offer ID: 77x3bqwm (remains same)
-- Pack ID: b07be6d1-352d-4742-b550-ff3029b16607

UPDATE packs 
SET gateway_ids = jsonb_set(
    COALESCE(gateway_ids, '{}'::jsonb),
    '{hotmart}',
    '{"product_id": "L104393461L", "offer_id": "77x3bqwm"}'::jsonb
)
WHERE id = 'b07be6d1-352d-4742-b550-ff3029b16607';

-- Verify the update
SELECT id, name, gateway_ids 
FROM packs 
WHERE id = 'b07be6d1-352d-4742-b550-ff3029b16607';
