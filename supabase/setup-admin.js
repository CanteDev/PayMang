/**
 * Script para crear usuario admin en Supabase
 * Ejecutar: node supabase/setup-admin.js
 * 
 * REQUISITO: Añadir SUPABASE_SERVICE_ROLE_KEY al archivo .env
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const ADMIN_EMAIL = 'canteriyu@gmail.com';
const ADMIN_PASSWORD = 'PayMang2024!'; // Cambiar después del primer login
const ADMIN_NAME = 'Miguel Cantera';

async function createAdminUser() {
    console.log('🚀 Iniciando setup de usuario admin...\n');

    // Verificar variables de entorno
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceRoleKey) {
        console.error('❌ ERROR: Faltan variables de entorno');
        console.log('\nAsegúrate de tener en tu .env:');
        console.log('- NEXT_PUBLIC_SUPABASE_URL');
        console.log('- SUPABASE_SERVICE_ROLE_KEY (desde Supabase > Settings > API > service_role key)');
        process.exit(1);
    }

    // Cliente con permisos de admin
    const supabase = createClient(supabaseUrl, serviceRoleKey, {
        auth: {
            autoRefreshToken: false,
            persistSession: false
        }
    });

    try {
        // 1. Crear usuario en auth.users
        console.log('📧 Creando usuario de autenticación...');
        const { data: authData, error: authError } = await supabase.auth.admin.createUser({
            email: ADMIN_EMAIL,
            password: ADMIN_PASSWORD,
            email_confirm: true, // Auto-confirmar email
            user_metadata: {
                full_name: ADMIN_NAME
            }
        });

        if (authError) {
            // Si el usuario ya existe, intentar obtenerlo
            if (authError.message.includes('already registered')) {
                console.log('⚠️  Usuario ya existe, obteniendo datos...');
                const { data: users } = await supabase.auth.admin.listUsers();
                const existingUser = users?.users.find(u => u.email === ADMIN_EMAIL);

                if (existingUser) {
                    console.log('✅ Usuario encontrado:', existingUser.id);

                    // Verificar si ya tiene perfil
                    const { data: existingProfile } = await supabase
                        .from('profiles')
                        .select('*')
                        .eq('id', existingUser.id)
                        .single();

                    if (existingProfile) {
                        console.log('✅ Perfil admin ya existe');
                        console.log('\n🎉 Setup completado!');
                        console.log(`📧 Email: ${ADMIN_EMAIL}`);
                        console.log(`🔑 Password: ${ADMIN_PASSWORD}`);
                        console.log('\n🌐 Ahora puedes hacer login en: http://localhost:3000/login');
                        process.exit(0);
                    }

                    // Crear perfil
                    await createProfile(supabase, existingUser.id);
                    process.exit(0);
                }
            }
            throw authError;
        }

        console.log('✅ Usuario creado:', authData.user.id);

        // 2. Crear perfil en profiles
        await createProfile(supabase, authData.user.id);

        console.log('\n🎉 Setup completado!');
        console.log(`📧 Email: ${ADMIN_EMAIL}`);
        console.log(`🔑 Password: ${ADMIN_PASSWORD}`);
        console.log('\n🌐 Ahora puedes hacer login en: http://localhost:3000/login');
        console.log('⚠️  IMPORTANTE: Cambia la contraseña después del primer login\n');

    } catch (error) {
        console.error('❌ Error:', error.message);
        process.exit(1);
    }
}

async function createProfile(supabase, userId) {
    console.log('👤 Creando perfil admin...');

    const { error: profileError } = await supabase
        .from('profiles')
        .insert({
            id: userId,
            email: ADMIN_EMAIL,
            full_name: ADMIN_NAME,
            role: 'admin',
            is_active: true
        });

    if (profileError) {
        throw new Error(`Error creando perfil: ${profileError.message}`);
    }

    console.log('✅ Perfil admin creado');
}

// Ejecutar
createAdminUser();
