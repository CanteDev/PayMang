-- ==================================================
-- Script para crear usuario ADMIN en PayMang
-- Email: canteriyu@gmail.com
-- ==================================================

-- PASO 1: Primero crea el usuario en Supabase UI
-- Ve a: Authentication > Users > Add User
-- Email: canteriyu@gmail.com
-- Password: (elige una segura, ej: Admin2024!)
-- ✅ Marca "Auto Confirm User"

-- PASO 2: Ejecuta este SQL para crear el perfil admin
-- (Ejecutar DESPUÉS de crear el usuario en la UI)

INSERT INTO profiles (id, email, full_name, role, is_active)
SELECT 
  id,
  'canteriyu@gmail.com',
  'Miguel Cantera',
  'admin',
  true
FROM auth.users 
WHERE email = 'canteriyu@gmail.com';

-- PASO 3: Verificar que se creó correctamente
SELECT 
  p.id,
  p.email,
  p.full_name,
  p.role,
  p.is_active,
  u.created_at
FROM profiles p
JOIN auth.users u ON u.id = p.id
WHERE p.email = 'canteriyu@gmail.com';

-- Si todo está OK, verás tu perfil con role = 'admin'
