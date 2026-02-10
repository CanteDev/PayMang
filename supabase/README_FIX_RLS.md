# 🔧 Fix RLS - Instrucciones

## El Problema

Las políticas RLS tienen una **recursión infinita** que impide el login.

**Error:** `infinite recursion detected in policy for relation "profiles"`

## Solución Rápida (5 minutos)

### Opción A: Supabase Dashboard (Recomendado)

1. Ve a [Supabase Dashboard](https://supabase.com/dashboard)
2. Selecciona tu proyecto PayMang
3. Click en **SQL Editor** (menú izquierdo)
4. Click en **New Query**
5. Copia y pega este código:

```sql
-- Eliminar políticas problemáticas
DROP POLICY IF EXISTS "profiles_select_all" ON profiles;
DROP POLICY IF EXISTS "profiles_update_own" ON profiles;
DROP POLICY IF EXISTS "profiles_update_admin" ON profiles;

-- Crear políticas correctas (sin recursión)
CREATE POLICY "profiles_select_authenticated" ON profiles
  FOR SELECT TO authenticated
  USING (is_active = true);

CREATE POLICY "profiles_update_own" ON profiles
  FOR UPDATE TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "profiles_insert_own" ON profiles
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = id);
```

6. Click en **RUN** (o Ctrl+Enter)
7. Deberías ver "Success. No rows returned"

### Verificar que funcionó

Ejecuta en tu terminal:

```bash
node supabase\test-login.js
```

Deberías ver:
```
✅ Autenticación exitosa!
✅ Perfil obtenido exitosamente!
```

## Opción B: CLI de Supabase (Alternativa)

Si tienes Supabase CLI instalado:

```bash
# 1. Hacer login
supabase login

# 2. Link al proyecto
supabase link --project-ref TU_PROJECT_REF

# 3. Ejecutar migration
supabase db execute -f supabase/FIX_RLS_RECURSION.sql
```

## Opción C: Conexión Directa PostgreSQL

Si tienes las credenciales de PostgreSQL:

```bash
psql "postgresql://postgres:[PASSWORD]@db.[PROJECT_REF].supabase.co:5432/postgres" -f supabase/FIX_RLS_RECURSION.sql
```

---

## Una vez aplicado

La aplicación funcionará correctamente. Podrás hacer login con:

- **Admin:** canteriyu@gmail.com / PayMang2024!
- **Coach:** coach@test.com / Coach123!
- **Closer:** closer@test.com / Closer123!
- **Setter:** setter@test.com / Setter123!

Ve a: http://localhost:3000/login
