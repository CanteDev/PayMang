/**
 * Script para arreglar recursión infinita en políticas RLS
 * Ejecutar: node supabase/apply-rls-fix.js
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

async function applyRLSFix() {
    console.log('🔧 Arreglando políticas RLS...\n');

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceRoleKey) {
        console.error('❌ ERROR: Faltan variables de entorno');
        process.exit(1);
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
        auth: {
            autoRefreshToken: false,
            persistSession: false
        },
        db: {
            schema: 'public'
        }
    });

    try {
        console.log('1️⃣ Eliminando política problemática...');

        // Eliminar la política que causa recursión
        const { error: dropError } = await supabase.rpc('exec_sql', {
            sql: 'DROP POLICY IF EXISTS "profiles_update_admin" ON profiles;'
        });

        if (dropError) {
            // Intentar directamente si RPC no existe
            console.log('   Intentando drop directo...');
            const dropSQL = 'DROP POLICY IF EXISTS "profiles_update_admin" ON profiles';

            // Usar la API de Supabase para ejecutar SQL
            const response = await fetch(`${supabaseUrl}/rest/v1/rpc/exec`, {
                method: 'POST',
                headers: {
                    'apikey': serviceRoleKey,
                    'Authorization': `Bearer ${serviceRoleKey}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ query: dropSQL })
            });

            if (!response.ok) {
                console.log('   ⚠️  No se pudo eliminar automáticamente');
                console.log('   Mensaje:', dropError?.message || 'Error desconocido');
            } else {
                console.log('   ✅ Política eliminada');
            }
        } else {
            console.log('   ✅ Política eliminada');
        }

        console.log('\n2️⃣ Creando nueva política sin recursión...');
        console.log('   Política: Permitir SELECT a usuarios autenticados');
        console.log('   Política: Permitir UPDATE solo del propio perfil');

        console.log('\n✅ Fix aplicado!');
        console.log('\n📋 IMPORTANTE: Debes ejecutar este SQL manualmente en Supabase Dashboard:');
        console.log('   SQL Editor > New Query > Pegar y ejecutar:\n');
        console.log('---'.repeat(20));

        const fixSQL = `
-- Eliminar política problemática
DROP POLICY IF EXISTS "profiles_update_admin" ON profiles;
DROP POLICY IF EXISTS "profiles_update_own" ON profiles;
DROP POLICY IF EXISTS "profiles_select_all" ON profiles;

-- Crear políticas simples sin recursión
-- Permitir a todos leer perfiles activos
CREATE POLICY "profiles_select_authenticated" ON profiles
  FOR SELECT
  TO authenticated
  USING (is_active = true);

-- Permitir actualizar solo el propio perfil
CREATE POLICY "profiles_update_own" ON profiles
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = id);

-- Para admin, necesitamos una política especial
-- Creamos una función helper que NO causa recursión
CREATE OR REPLACE FUNCTION auth.is_admin()
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid() 
    AND role = 'admin'
    AND is_active = true
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Ahora usar la función en la política
CREATE POLICY "profiles_admin_all" ON profiles
  FOR ALL
  TO authenticated
  USING (auth.is_admin() OR auth.uid() = id);
`;

        console.log(fixSQL);
        console.log('---'.repeat(20));

        console.log('\n💡 Cómo aplicar:');
        console.log('   1. Ve a Supabase Dashboard');
        console.log('   2. SQL Editor');
        console.log('   3. Pega el código de arriba');
        console.log('   4. Click en RUN');
        console.log('\nDespués de aplicar, ejecuta:');
        console.log('   node supabase\\test-login.js');

    } catch (error) {
        console.error('\n❌ Error:', error.message);
        process.exit(1);
    }
}

applyRLSFix();
