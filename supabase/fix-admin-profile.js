/**
 * Script simplificado para crear perfil de admin
 * Ejecutar: node supabase/fix-admin-profile.js
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const ADMIN_EMAIL = 'canteriyu@gmail.com';
const ADMIN_NAME = 'Miguel Cantera';

async function fixAdminProfile() {
    console.log('🔧 Creando perfil admin para usuario existente...\n');

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceRoleKey) {
        console.error('❌ ERROR: Faltan variables de entorno');
        console.log('\nNecesitas en tu .env:');
        console.log('- NEXT_PUBLIC_SUPABASE_URL');
        console.log('- SUPABASE_SERVICE_ROLE_KEY');
        process.exit(1);
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
        auth: {
            autoRefreshToken: false,
            persistSession: false
        }
    });

    try {
        // 1. Obtener el usuario existente
        console.log('🔍 Buscando usuario...');
        const { data: users } = await supabase.auth.admin.listUsers();
        const existingUser = users?.users.find(u => u.email === ADMIN_EMAIL);

        if (!existingUser) {
            console.error('❌ Usuario no encontrado en auth.users');
            console.log('\nDebes crear el usuario primero en Supabase Dashboard:');
            console.log('Authentication > Add User');
            process.exit(1);
        }

        console.log('✅ Usuario encontrado:', existingUser.id);

        // 2. Verificar si ya tiene perfil
        const { data: existingProfile } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', existingUser.id)
            .single();

        if (existingProfile) {
            console.log('✅ El perfil ya existe');
            console.log('\nDatos del perfil:');
            console.log('  ID:', existingProfile.id);
            console.log('  Email:', existingProfile.email);
            console.log('  Nombre:', existingProfile.full_name);
            console.log('  Rol:', existingProfile.role);
            console.log('  Activo:', existingProfile.is_active);
            console.log('\n✅ Todo correcto!');
            return;
        }

        // 3. Crear el perfil
        console.log('➕ Creando perfil admin...');
        const { error: profileError } = await supabase
            .from('profiles')
            .insert({
                id: existingUser.id,
                email: ADMIN_EMAIL,
                full_name: ADMIN_NAME,
                role: 'admin',
                is_active: true
            });

        if (profileError) {
            console.error('❌ Error creando perfil:', profileError.message);
            process.exit(1);
        }

        console.log('✅ Perfil admin creado exitosamente!');
        console.log('\n🎉 Ahora puedes hacer login con:');
        console.log('  📧 Email: canteriyu@gmail.com');
        console.log('  🔑 Password: PayMang2024!');
        console.log('\n🌐 URL: http://localhost:3000/login');

    } catch (error) {
        console.error('❌ Error:', error.message);
        process.exit(1);
    }
}

fixAdminProfile();
