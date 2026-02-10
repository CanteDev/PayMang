/**
 * Script para resetear la contraseña del usuario admin
 * Ejecutar: node supabase/reset-admin-password.js
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

async function resetAdminPassword() {
    console.log('🔐 Reseteando contraseña del admin...\n');

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
        const ADMIN_EMAIL = 'canteriyu@gmail.com';
        const NEW_PASSWORD = 'PayMang2024!';

        // 1. Buscar usuario
        console.log('🔍 Buscando usuario...');
        const { data: users } = await supabase.auth.admin.listUsers();
        const user = users?.users.find(u => u.email === ADMIN_EMAIL);

        if (!user) {
            console.error('❌ Usuario no encontrado');
            process.exit(1);
        }

        console.log('✅ Usuario encontrado:', user.id);

        // 2. Actualizar contraseña
        console.log('\n🔄 Actualizando contraseña...');
        const { error } = await supabase.auth.admin.updateUserById(
            user.id,
            { password: NEW_PASSWORD }
        );

        if (error) {
            console.error('❌ Error actualizando contraseña:', error.message);
            process.exit(1);
        }

        console.log('✅ Contraseña actualizada exitosamente!');
        console.log('\n🎉 Credenciales actualizadas:');
        console.log('   📧 Email: canteriyu@gmail.com');
        console.log('   🔑 Nueva Password: PayMang2024!');
        console.log('\n🌐 Prueba hacer login en: http://localhost:3000/login');
        console.log('\n💡 Recomendación: Usa una ventana de incógnito para evitar problemas de caché');

    } catch (error) {
        console.error('\n❌ Error:', error.message);
        process.exit(1);
    }
}

resetAdminPassword();
