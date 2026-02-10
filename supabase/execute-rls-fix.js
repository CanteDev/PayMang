/**
 * Script para ejecutar el fix de RLS usando la API HTTP de Supabase
 * Ejecutar: node supabase/execute-rls-fix.js
 */

require('dotenv').config();
const https = require('https');
const { URL } = require('url');

async function executeSQL(sql) {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceRoleKey) {
        throw new Error('Faltan variables de entorno');
    }

    // Extraer el project ref de la URL
    const urlObj = new URL(supabaseUrl);
    const projectRef = urlObj.hostname.split('.')[0];

    // Usar la API de postgREST query
    const queryUrl = `${supabaseUrl}/rest/v1/rpc/exec`;

    return new Promise((resolve, reject) => {
        const postData = JSON.stringify({ query: sql });
        const urlParsed = new URL(queryUrl);

        const options = {
            hostname: urlParsed.hostname,
            port: urlParsed.port || 443,
            path: urlParsed.pathname,
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'apikey': serviceRoleKey,
                'Authorization': `Bearer ${serviceRoleKey}`,
                'Content-Length': Buffer.byteLength(postData)
            }
        };

        const req = https.request(options, (res) => {
            let data = '';

            res.on('data', (chunk) => {
                data += chunk;
            });

            res.on('end', () => {
                if (res.statusCode >= 200 && res.statusCode < 300) {
                    resolve({ success: true, data });
                } else {
                    resolve({ success: false, error: data, statusCode: res.statusCode });
                }
            });
        });

        req.on('error', (e) => {
            reject(e);
        });

        req.write(postData);
        req.end();
    });
}

async function executeRLSFix() {
    console.log('🔧 Ejecutando fix de RLS...\n');

    const queries = [
        'DROP POLICY IF EXISTS "profiles_select_all" ON profiles',
        'DROP POLICY IF EXISTS "profiles_update_own" ON profiles',
        'DROP POLICY IF EXISTS "profiles_update_admin" ON profiles',
        `CREATE POLICY "profiles_select_authenticated" ON profiles FOR SELECT TO authenticated USING (is_active = true)`,
        `CREATE POLICY "profiles_update_own" ON profiles FOR UPDATE TO authenticated USING (auth.uid() = id)`,
        `CREATE POLICY "profiles_insert_own" ON profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id)`
    ];

    for (let i = 0; i < queries.length; i++) {
        const query = queries[i];
        const isDropQuery = query.startsWith('DROP');
        const queryName = isDropQuery ? `Eliminando política ${i + 1}/3` : `Creando política ${i - 2}/3`;

        console.log(`${i + 1}. ${queryName}...`);

        try {
            const result = await executeSQL(query);
            if (result.success || (isDropQuery && result.statusCode === 404)) {
                console.log('   ✅ OK');
            } else {
                console.log(`   ⚠️  Status: ${result.statusCode}`);
                console.log(`   Respuesta: ${result.error}`);
            }
        } catch (error) {
            console.log(`   ⚠️  ${error.message}`);
        }
    }

    console.log('\n✅ Queries ejecutadas!');
    console.log('\n🧪 Probando login...\n');

    // Importar y probar
    const { createClient } = require('@supabase/supabase-js');
    const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    );

    try {
        const { data, error } = await supabase.auth.signInWithPassword({
            email: 'coach@test.com',
            password: 'Coach123!'
        });

        if (error) {
            throw error;
        }

        console.log('✅ Login exitoso!');

        const { data: profile, error: profileError } = await supabase
            .from('profiles')
            .select('role')
            .eq('id', data.user.id)
            .single();

        if (profileError) {
            throw profileError;
        }

        console.log('✅ Perfil obtenido:', profile.role);
        console.log('\n🎉 ¡TODO FUNCIONANDO!');

        await supabase.auth.signOut();

    } catch (testError) {
        console.error('❌ Error en test:', testError.message);
        console.log('\nLas queries se ejecutaron pero aún hay problemas.');
        console.log('Puede que necesites ejecutar el SQL manualmente en Supabase Dashboard.');
        return;
    }

    console.log('\n📧 Credenciales listas para usar:');
    console.log('   - canteriyu@gmail.com / PayMang2024!');
    console.log('   - coach@test.com / Coach123!');
    console.log('   - closer@test.com / Closer123!');
    console.log('   - setter@test.com / Setter123!');
    console.log('\n🌐 http://localhost:3000/login');
}

executeRLSFix().catch(console.error);
