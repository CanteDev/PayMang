# Configuración de Supabase

Para configurar el proyecto PayMang con Supabase, sigue estos pasos:

## 1. Crear Proyecto en Supabase

1. Ve a [https://supabase.com](https://supabase.com)
2. Crea una nueva cuenta o inicia sesión
3. Haz clic en "New Project"
4. Completa:
   - **Name**: PayMang Dev (o el nombre que prefieras)
   - **Database Password**: Guarda esta contraseña de forma segura (PrimaveraVerano.01)
   - **Region**: Elige la más cercana a tus usuarios
   - **Pricing Plan**: Free (para desarrollo)

## 2. Ejecutar Migraciones 

Una vez creado el proyecto:

1. Ve a la sección **SQL Editor** en el panel lateral
2. Copia todo el contenido de `supabase/migrations/001_initial_schema.sql`
3. Pégalo en el editor SQL
4. Haz clic en **Run** o presiona `Ctrl+Enter`

Esto creará:
- ✅ 6 ENUMs
- ✅ 7 Tablas maestras
- ✅ Políticas RLS
- ✅ Índices para optimización
- ✅ Triggers para updated_at automático

## 3. Obtener Credenciales

Ve a **Project Settings** → **API**:

1. Copia el **Project URL**
2. Copia el **anon/public key**

## 4. Configurar Variables de Entorno

1. Copia el archivo `.env.example` a `.env`:
   ```bash
   cp .env.example .env
   ```

2. Edita `.env` y completa:
   ```env
   NEXT_PUBLIC_SUPABASE_URL=https://tu-proyecto.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=tu-anon-key-aqui
   ```

## 5. Crear Usuario Admin Inicial

Ejecuta este SQL en Supabase SQL Editor para crear el primer admin:

```sql
-- Primero, crea el usuario en auth.users (esto lo haremos desde la UI de Supabase)
-- Ve a Authentication > Add User
-- Email: admin@paymang.com
-- Password: (escoge una segura)
-- Auto Confirm: Yes

-- Luego, obtén el UUID del usuario recién creado
SELECT id FROM auth.users WHERE email = 'admin@paymang.com';

-- Inserta el perfil del admin (reemplaza 'USER_UUID_AQUI' con el UUID real)
INSERT INTO profiles (id, email, full_name, role, is_active)
VALUES (
  'USER_UUID_AQUI',
  'admin@paymang.com',
  'Administrador',
  'admin',
  true
);
```

## 6. Verificar RLS

Para verificar que las políticas RLS están activas:

```sql
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public';
```

Todas las tablas deben tener `rowsecurity = true`.

## 7. Crear Datos de Prueba (Opcional)

```sql
-- Pack de ejemplo
INSERT INTO packs (name, price, gateway_ids, is_active)
VALUES (
  'Pack Bronze',
  997.00,
  '{"stripe_prod_id": "prod_test_123", "hotmart_prod_id": "12345"}'::jsonb,
  true
);

-- Alumno de ejemplo
INSERT INTO students (email, full_name, phone, status)
VALUES (
  'alumno@example.com',
  'Juan Pérez',
  '+34600000000',
  'active'
);
```

## 🚨 Seguridad

- **NUNCA** commits el archivo `.env` (ya está en `.gitignore`)
- **NUNCA** expongas las credenciales en el código cliente
- Para producción, usa variables de entorno de Vercel

## Siguiente Paso

Una vez configurado Supabase, puedes:
1. Iniciar el servidor de desarrollo: `npm run dev`
2. Acceder a la app en `http://localhost:3000`
3. Ir a `/login` y usar las credenciales del admin
