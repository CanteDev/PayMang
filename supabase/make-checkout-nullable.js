const https = require('https');
require('dotenv').config();

async function applyMigration() {
    console.log('📦 Aplicando migración: Make checkout_url nullable...');

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceKey) {
        console.error('❌ Variables de entorno faltantes');
        return;
    }

    const projectRef = supabaseUrl.match(/https:\/\/([^.]+)\.supabase\.co/)[1];
    const sql = "ALTER TABLE pack_offers ALTER COLUMN checkout_url DROP NOT NULL;";

    const options = {
        hostname: `${projectRef}.supabase.co`,
        port: 443,
        path: '/rest/v1/rpc/exec_sql',
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'apikey': serviceKey,
            'Authorization': `Bearer ${serviceKey}`,
            'Prefer': 'return=minimal'
        }
    };

    const postData = JSON.stringify({ query: sql });

    const req = https.request(options, (res) => {
        let data = '';

        res.on('data', (chunk) => {
            data += chunk;
        });

        res.on('end', () => {
            console.log('✅ Status:', res.statusCode);
            console.log('Datos:', data);
            if (res.statusCode >= 200 && res.statusCode < 300) {
                console.log('✅ Migración aplicada exitosamente');
            }
        });
    });

    req.on('error', (error) => {
        console.error('❌ Error:', error.message);
    });

    req.write(postData);
    req.end();
}

applyMigration();
