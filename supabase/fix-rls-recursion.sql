-- ============================================
-- FIX: Corrección de políticas RLS con recursión infinita
-- ============================================
-- PROBLEMA: La política profiles_update_admin causa recursión infinita
-- porque consulta la tabla profiles para verificar si el usuario es admin

-- PASO 1: Eliminar políticas problemáticas
DROP POLICY IF EXISTS "profiles_update_admin" ON profiles;

-- PASO 2: Recrear política sin recursión
-- Los usuarios pueden ver todos los perfiles activos sin verificar rol
-- (la política profiles_select_all ya permite esto)

-- Para INSERT/UPDATE/DELETE de admin, usar el enfoque de auth.jwt()
CREATE POLICY "profiles_admin_all" ON profiles
  FOR ALL
  USING (
    (auth.jwt() -> 'user_metadata' ->> 'role')::text = 'admin'
    OR
    -- Alternativamente, verificar directamente con auth.uid()
    -- sin usar SELECT anidado
    id = auth.uid()
  );

-- NOTA: Si auth.jwt() no funciona, necesitaremos una función auxiliar

-- ============================================
-- Verificar que las políticas se aplicaron correctamente
-- ============================================
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual
FROM pg_policies 
WHERE tablename = 'profiles';
