const { createClient } = require('@supabase/supabase-js');
const https = require('https');
require('dotenv').config();

async function applyMigrationViaAPI() {
    console.log('🔧 Aplicando migración usando Supabase Management API...\n');

    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const projectRef = 'rjspuxdvpdwescrvudgz'; // from the URL

    const sql = `
ALTER TABLE students ADD COLUMN IF NOT EXISTS closer_id UUID REFERENCES profiles(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_students_closer ON students(closer_id);
COMMENT ON COLUMN students.closer_id IS 'The closer assigned to this student';
    `.trim();

    const options = {
        hostname: `${projectRef}.supabase.co`,
        port: 443,
        path: '/rest/v1/rpc/exec_sql',
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'apikey': serviceRoleKey,
            'Authorization': `Bearer ${serviceRoleKey}`,
            'Prefer': 'return=minimal'
        }
    };

    return new Promise((resolve, reject) => {
        const req = https.request(options, (res) => {
            let data = '';

            res.on('data', (chunk) => {
                data += chunk;
            });

            res.on('end', () => {
                if (res.statusCode === 200 || res.statusCode === 201 || res.statusCode === 204) {
                    console.log('✅ Migración aplicada exitosamente');
                    resolve(true);
                } else {
                    console.log(`⚠️ Status: ${res.statusCode}`);
                    console.log(`Response: ${data}`);
                    resolve(false);
                }
            });
        });

        req.on('error', (error) => {
            console.error('❌ Error:', error.message);
            resolve(false);
        });

        req.write(JSON.stringify({ sql }));
        req.end();
    });
}

async function verifyMigration() {
    const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    console.log('\n🔍 Verificando migración...');
    const { data, error } = await supabase
        .from('students')
        .select('id, closer_id')
        .limit(1);

    if (!error) {
        console.log('✅ MIGRACIÓN VERIFICADA - La columna closer_id está disponible');
        return true;
    } else if (error.message.includes('column "closer_id" does not exist')) {
        console.log('❌ La columna closer_id NO existe');
        return false;
    } else {
        console.log('⚠️ Error de verificación:', error.message);
        return false;
    }
}

async function main() {
    const applied = await applyMigrationViaAPI();
    const verified = await verifyMigration();

    if (verified) {
        console.log('\n🎯 Base de datos lista para testing E2E\n');
        process.exit(0);
    } else {
        console.log('\n📋 Por favor ejecuta este SQL manualmente en Supabase SQL Editor:');
        console.log('   https://supabase.com/dashboard/project/rjspuxdvpdwescrvudgz/sql\n');
        console.log('ALTER TABLE students ADD COLUMN closer_id UUID REFERENCES profiles(id) ON DELETE SET NULL;');
        console.log('CREATE INDEX idx_students_closer ON students(closer_id);\n');
        process.exit(1);
    }
}

main();
