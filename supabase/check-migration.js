const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkAndApplyMigration() {
    console.log('🔍 Verificando si la columna closer_id existe...');

    try {
        // Try to select closer_id from students
        const { data, error } = await supabase
            .from('students')
            .select('id, closer_id')
            .limit(1);

        if (error) {
            if (error.message.includes('column "closer_id" does not exist')) {
                console.log('❌ La columna closer_id NO existe');
                console.log('\n📋 Por favor ejecuta manualmente desde Supabase SQL Editor:');
                console.log('👉 https://supabase.com/dashboard/project/rjspuxdvpdwescrvudgz/sql\n');
                console.log('------- COPIA Y EJECUTA ESTE SQL -------');
                console.log(`
-- Add closer_id field to students table
ALTER TABLE students
ADD COLUMN closer_id UUID REFERENCES profiles(id) ON DELETE SET NULL;

-- Create index for better query performance
CREATE INDEX idx_students_closer ON students(closer_id);

-- Add comment
COMMENT ON COLUMN students.closer_id IS 'The closer assigned to this student';
                `);
                console.log('----------------------------------------\n');
                return false;
            } else {
                console.error('❌ Error al verificar:', error);
                return false;
            }
        } else {
            console.log('✅ La columna closer_id YA EXISTE en la base de datos');
            console.log('📊 Registros encontrados:', data?.length || 0);
            return true;
        }
    } catch (err) {
        console.error('❌ Error:', err.message);
        return false;
    }
}

checkAndApplyMigration().then(exists => {
    if (exists) {
        console.log('\n✅ La base de datos está lista para el test E2E');
    } else {
        console.log('\n⚠️ Necesitas aplicar la migración manualmente antes de continuar');
    }
    process.exit(exists ? 0 : 1);
});
