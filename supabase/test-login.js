/**
 * Script para simular el proceso de login completo
 * Ejecutar: node supabase/test-login.js
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

async function testLogin() {
    console.log('🧪 Simulando proceso de login...\n');

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !anonKey) {
        console.error('❌ ERROR: Faltan variables de entorno');
        console.log('Necesitas: NEXT_PUBLIC_SUPABASE_URL y NEXT_PUBLIC_SUPABASE_ANON_KEY');
        process.exit(1);
    }

    // IMPORTANTE: Usar la ANON KEY como en el cliente
    const supabase = createClient(supabaseUrl, anonKey);

    const testUsers = [
        { email: 'canteriyu@gmail.com', password: 'PayMang2024!', role: 'admin' },
        { email: 'coach@test.com', password: 'Coach123!', role: 'coach' },
        { email: 'closer@test.com', password: 'Closer123!', role: 'closer' },
        { email: 'setter@test.com', password: 'Setter123!', role: 'setter' }
    ];

    for (const testUser of testUsers) {
        console.log(`\n${'='.repeat(60)}`);
        console.log(`Testing: ${testUser.email}`);
        console.log('='.repeat(60));

        try {
            // 1. Intentar login
            console.log('\n1️⃣ Intentando signInWithPassword...');
            const { data: authData, error: signInError } = await supabase.auth.signInWithPassword({
                email: testUser.email,
                password: testUser.password,
            });

            if (signInError) {
                console.error('❌ Error de autenticación:', signInError.message);
                console.log('   Código:', signInError.status);
                continue;
            }

            if (!authData.user) {
                console.error('❌ No se obtuvo usuario');
                continue;
            }

            console.log('✅ Autenticación exitosa!');
            console.log('   User ID:', authData.user.id);
            console.log('   Email:', authData.user.email);

            // 2. Intentar obtener el perfil (EXACTAMENTE como en login page)
            console.log('\n2️⃣ Obteniendo perfil desde tabla profiles...');
            const { data: profile, error: profileError } = await supabase
                .from('profiles')
                .select('role')
                .eq('id', authData.user.id)
                .single();

            if (profileError) {
                console.error('❌ Error obteniendo perfil:', profileError.message);
                console.log('   Código:', profileError.code);
                console.log('   Detalles:', profileError.details);
                console.log('   Hint:', profileError.hint);

                // Verificar con service role key si el perfil existe
                console.log('\n🔍 Verificando con service role key...');
                const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
                if (serviceRoleKey) {
                    const adminSupabase = createClient(supabaseUrl, serviceRoleKey);
                    const { data: adminProfile } = await adminSupabase
                        .from('profiles')
                        .select('*')
                        .eq('id', authData.user.id)
                        .single();

                    if (adminProfile) {
                        console.log('   ⚠️  El perfil SÍ existe en la BD:');
                        console.log('      - Email:', adminProfile.email);
                        console.log('      - Role:', adminProfile.role);
                        console.log('      - is_active:', adminProfile.is_active);
                        console.log('\n   🚨 PROBLEMA: RLS está bloqueando el acceso!');
                    } else {
                        console.log('   ❌ El perfil NO existe en la BD');
                    }
                }

                // Hacer logout
                await supabase.auth.signOut();
                continue;
            }

            console.log('✅ Perfil obtenido exitosamente!');
            console.log('   Role:', profile.role);
            console.log('   Expected:', testUser.role);

            if (profile.role === testUser.role) {
                console.log('   ✅ Rol correcto!');
            } else {
                console.log('   ⚠️  Rol no coincide!');
            }

            // 3. Hacer logout
            await supabase.auth.signOut();
            console.log('\n✅ Test completado para', testUser.email);

        } catch (err) {
            console.error('\n❌ Error inesperado:', err.message);
            console.error(err);
        }
    }

    console.log(`\n${'='.repeat(60)}`);
    console.log('🏁 Tests completados');
    console.log('='.repeat(60));
}

testLogin();
