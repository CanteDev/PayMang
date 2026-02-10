/**
 * Script para arreglar RLS usando queries individuales
 * Ejecutar: node supabase/fix-rls-direct.js
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

async function fixRLSDirect() {
    console.log('🔧 Arreglando políticas RLS directamente...\n');

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
        }
    });

    try {
        const queries = [
            {
                name: 'Eliminar profiles_select_all',
                sql: 'DROP POLICY IF EXISTS "profiles_select_all" ON profiles'
            },
            {
                name: 'Eliminar profiles_update_own',
                sql: 'DROP POLICY IF EXISTS "profiles_update_own" ON profiles'
            },
            {
                name: 'Eliminar profiles_update_admin (recursiva)',
                sql: 'DROP POLICY IF EXISTS "profiles_update_admin" ON profiles'
            },
            {
                name: 'Crear nueva política SELECT',
                sql: `CREATE POLICY "profiles_select_authenticated" ON profiles
                      FOR SELECT
                      TO authenticated
                      USING (is_active = true)`
            },
            {
                name: 'Crear nueva política UPDATE own',
                sql: `CREATE POLICY "profiles_update_own" ON profiles
                      FOR UPDATE
                      TO authenticated
                      USING (auth.uid() = id)`
            },
            {
                name: 'Crear nueva política INSERT para autenticados',
                sql: `CREATE POLICY "profiles_insert_own" ON profiles
                      FOR INSERT
                      TO authenticated
                      WITH CHECK (auth.uid() = id)`
            }
        ];

        for (const query of queries) {
            console.log(`📝 ${query.name}...`);

            const { error } = await supabase.rpc('exec', {
                sql: query.sql
            }).catch(async () => {
                // Si rpc no funciona, intentar con la función query directa
                const { error: directError } = await supabase
                    .from('_sql')
                    .insert({ query: query.sql });

                return { error: directError };
            });

            if (error && !error.message.includes('does not exist')) {
                console.log(`   ⚠️  ${error.message}`);
            } else {
                console.log(`   ✅ OK`);
            }
        }

        console.log('\n✅ Políticas actualizadas!');
        console.log('\n🧪 Probando login ahora...\n');

        // Probar login inmediatamente
        const testSupabase = createClient(supabaseUrl, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

        const { data, error } = await testSupabase.auth.signInWithPassword({
            email: 'coach@test.com',
            password: 'Coach123!'
        });

        if (error) {
            console.error('❌ Error en login:', error.message);
            throw error;
        }

        console.log('✅ Login exitoso!');
        const { data: profile, error: profileError } = await testSupabase
            .from('profiles')
            .select('role')
            .eq('id', data.user.id)
            .single();

        if (profileError) {
            console.error('❌ Error obteniendo perfil:', profileError.message);
            console.log('\n⚠️  Las políticas aún tienen problemas.');
            console.log('Necesitas ejecutar el SQL manualmente en Supabase Dashboard.\n');
            throw profileError;
        }

        console.log('✅ Perfil obtenido:', profile.role);
        console.log('\n🎉 ¡FIX APLICADO EXITOSAMENTE!');
        console.log('\n📧 Puedes hacer login con cualquier usuario ahora:');
        console.log('   - canteriyu@gmail.com / PayMang2024!');
        console.log('   - coach@test.com / Coach123!');
        console.log('   - closer@test.com / Closer123!');
        console.log('   - setter@test.com / Setter123!');

        await testSupabase.auth.signOut();

    } catch (error) {
        console.error('\n❌ Error:', error.message);
        console.log('\n📋 Ejecuta este SQL manualmente en Supabase Dashboard > SQL Editor:');
        console.log('='.repeat(60));
        console.log(`
DROP POLICY IF EXISTS "profiles_select_all" ON profiles;
DROP POLICY IF EXISTS "profiles_update_own" ON profiles;
DROP POLICY IF EXISTS "profiles_update_admin" ON profiles;

CREATE POLICY "profiles_select_authenticated" ON profiles
  FOR SELECT TO authenticated
  USING (is_active = true);

CREATE POLICY "profiles_update_own" ON profiles
  FOR UPDATE TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "profiles_insert_own" ON profiles
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = id);
        `);
        console.log('='.repeat(60));
    }
}

fixRLSDirect();
