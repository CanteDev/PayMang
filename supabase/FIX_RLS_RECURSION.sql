-- ============================================
-- FIX CRÍTICO: Recursión Infinita en Políticas RLS
-- ============================================
-- PROBLEMA IDENTIFICADO:
-- La política "profiles_update_admin" causa recursión infinita porque
-- consulta la tabla profiles para verificar si el usuario es admin,
-- lo cual requiere acceso a profiles, creando un loop infinito.
--
-- ERROR: "infinite recursion detected in policy for relation profiles"
-- ============================================

-- PASO 1: Eliminar todas las políticas problemáticas
DROP POLICY IF EXISTS "profiles_select_all" ON profiles;
DROP POLICY IF EXISTS "profiles_update_own" ON profiles;
DROP POLICY IF EXISTS "profiles_update_admin" ON profiles;

-- PASO 2: Crear políticas simples SIN recursión

-- Permitir a usuarios autenticados leer perfiles activos
CREATE POLICY "profiles_select_authenticated" ON profiles
  FOR SELECT
  TO authenticated
  USING (is_active = true);

-- Permitir a cada usuario actualizar su propio perfil
CREATE POLICY "profiles_update_own" ON profiles
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = id);

-- Permitir a cada usuario insertar su propio perfil (para nuevos registros)
CREATE POLICY "profiles_insert_own" ON profiles
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

-- ============================================
-- FIN DEL FIX
-- ============================================

-- Verificar que las nuevas políticas se aplicaron correctamente
SELECT 
  policyname,
  cmd,
  CASE 
    WHEN cmd = 'SELECT' THEN 'Lectura'
    WHEN cmd = 'UPDATE' THEN 'Actualización'
    WHEN cmd = 'INSERT' THEN 'Inserción'
    ELSE cmd
  END as operacion
FROM pg_policies 
WHERE tablename = 'profiles'
ORDER BY policyname;
