const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function applyMigration() {
    console.log('🔧 Aplicando migración 003_add_closer_to_students.sql...\n');

    try {
        // Step 1: Add column
        console.log('1️⃣ Añadiendo columna closer_id...');
        const { error: error1 } = await supabase.rpc('exec_sql', {
            query: 'ALTER TABLE students ADD COLUMN IF NOT EXISTS closer_id UUID REFERENCES profiles(id) ON DELETE SET NULL;'
        });

        if (error1) {
            // Try alternative: Use direct SQL via postgrest
            console.log('   ⚠️ RPC no disponible, intentando método alternativo...');

            // We'll use a workaround: update a dummy record to trigger the schema check
            const { error: testError } = await supabase
                .from('students')
                .select('closer_id')
                .limit(1);

            if (testError && testError.message.includes('column "closer_id" does not exist')) {
                console.log('   ❌ La columna no existe y no puedo crearla automáticamente');
                console.log('   📋 Ejecuta este SQL manualmente en Supabase:');
                console.log('   ALTER TABLE students ADD COLUMN closer_id UUID REFERENCES profiles(id) ON DELETE SET NULL;');
                console.log('   CREATE INDEX idx_students_closer ON students(closer_id);');
                return false;
            } else if (!testError) {
                console.log('   ✅ La columna closer_id ya existe');
            }
        } else {
            console.log('   ✅ Columna closer_id añadida');
        }

        // Step 2: Create index
        console.log('2️⃣ Creando índice...');
        const { error: error2 } = await supabase.rpc('exec_sql', {
            query: 'CREATE INDEX IF NOT EXISTS idx_students_closer ON students(closer_id);'
        });

        if (!error2) {
            console.log('   ✅ Índice creado');
        } else {
            console.log('   ⚠️ El índice podría ya existir o no se pudo crear');
        }

        // Verify the column exists now
        console.log('\n🔍 Verificando migración...');
        const { data, error: verifyError } = await supabase
            .from('students')
            .select('id, closer_id')
            .limit(1);

        if (!verifyError) {
            console.log('✅ MIGRACIÓN EXITOSA - La columna closer_id está disponible\n');
            return true;
        } else {
            console.log('❌ Verificación fallida:', verifyError.message);
            return false;
        }

    } catch (err) {
        console.error('❌ Error aplicando migración:', err.message);
        return false;
    }
}

applyMigration().then(success => {
    if (success) {
        console.log('🎯 Base de datos lista para testing E2E\n');
    } else {
        console.log('⚠️ Migración no completada - Aplica el SQL manualmente\n');
    }
    process.exit(success ? 0 : 1);
});
