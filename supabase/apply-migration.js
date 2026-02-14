const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function applyMigration() {
    console.log('📦 Aplicando migración 002_add_cancelled_status.sql...');

    const migrationPath = path.join(__dirname, 'migrations', '002_add_cancelled_status.sql');
    const sql = fs.readFileSync(migrationPath, 'utf8');

    try {
        // Execute the SQL
        const { data, error } = await supabase.rpc('exec_sql', { sql_query: sql });

        if (error) {
            console.error('❌ Error aplicando migración:', error);

            // Try alternative approach - direct execution
            console.log('🔄 Intentando ejecución directa...');
            const { error: directError } = await supabase
                .from('students')
                .select('closer_id')
                .limit(1);

            if (directError && directError.message.includes('type "commission_status" already exists')) {
                console.log('⚠️ El enum ya existe, pero intentando añadir el valor...');

                console.log('❌ No se puede aplicar automáticamente. Por favor:');
                console.log('1. Ve a https://supabase.com/dashboard/project/[tu-proyecto]/sql');
                console.log('2. Copia y ejecuta el contenido de: supabase/migrations/002_add_cancelled_status.sql');
            } else if (!directError) {
                console.log('✅ El estado cancelled ya existe en la base de datos');
            }
        } else {
            console.log('✅ Migración aplicada exitosamente');
        }
    } catch (err) {
        console.error('❌ Error:', err.message);
        console.log('\n📋 Por favor ejecuta manualmente desde Supabase SQL Editor:');
        console.log(sql);
    }
}

applyMigration();
