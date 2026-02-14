# Configuración de Hotmart para Pack BASICO

## Credenciales de Hotmart Sandbox

- **Product ID:** 7192262
- **Offer ID:** 77x3bqwm

## SQL para actualizar el pack

Ejecuta este SQL en el **Supabase SQL Editor**:

```sql
-- Update BASICO pack with Hotmart product and offer IDs
-- Pack ID: b07be6d1-352d-4742-b550-ff3029b16607
UPDATE packs 
SET gateway_ids = jsonb_set(
    COALESCE(gateway_ids, '{}'::jsonb),
    '{hotmart}',
    '{"product_id": "7192262", "offer_id": "77x3bqwm"}'::jsonb
)
WHERE id = 'b07be6d1-352d-4742-b550-ff3029b16607';

-- Verify the update
SELECT id, name, price, gateway_ids 
FROM packs 
WHERE id = 'b07be6d1-352d-4742-b550-ff3029b16607';
```

## Pasos para ejecutar:

1. Ve a: https://supabase.com/dashboard/project/rjspuxdvpdwescrvudgz/sql
2. Haz clic en **"New Query"**
3. Pega el SQL de arriba
4. Haz clic en **"Run"**
5. Verifica que el resultado muestre el campo `gateway_ids` con los datos de Hotmart

## Resultado esperado:

El campo `gateway_ids` del pack BASICO debería verse así:

```json
{
  "hotmart": {
    "product_id": "7192262",
    "offer_id": "77x3bqwm"
  }
}
```

## Siguiente paso:

Una vez actualizado, podrás generar links de pago con gateway "hotmart" para el pack BASICO.
