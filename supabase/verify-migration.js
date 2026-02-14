const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function quickCheck() {
    console.log('🔍 Verificación rápida de la migración...\n');

    // Try to insert a test student with closer_id to see if column exists
    const testEmail = `migration_test_${Date.now()}@test.com`;

    const { data, error } = await supabase
        .from('students')
        .insert({
            email: testEmail,
            full_name: 'Migration Test',
            closer_id: null,
            status: 'active'
        })
        .select()
        .single();

    if (error) {
        if (error.message.includes('column "closer_id" does not exist')) {
            console.log('❌ MIGRACIÓN NO APLICADA');
            console.log('La columna closer_id NO existe en la base de datos\n');
            console.log('¿Estás seguro de que ejecutaste el SQL y apareció "Success"?');
            console.log('Por favor verifica en Supabase SQL Editor.\n');
            return false;
        } else {
            console.log('⚠️ Error inesperado:', error.message);
            return false;
        }
    } else {
        console.log('✅ ¡MIGRACIÓN VERIFICADA!');
        console.log('La columna closer_id existe y funciona correctamente\n');

        // Clean up test record
        await supabase.from('students').delete().eq('email', testEmail);

        return true;
    }
}

quickCheck().then(success => {
    process.exit(success ? 0 : 1);
});
