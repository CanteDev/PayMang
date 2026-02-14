const https = require('https');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

async function applyMigration() {
    console.log('📦 Aplicando migración: Add cancelled status...');

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceKey) {
        console.error('❌ Variables de entorno faltantes');
        return;
    }

    // Extract project ref from URL
    const projectRef = supabaseUrl.match(/https:\/\/([^.]+)\.supabase\.co/)[1];

    const sql = "ALTER TYPE commission_status ADD VALUE IF NOT EXISTS 'cancelled';";

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
            if (res.statusCode === 200 || res.statusCode === 204) {
                console.log('✅ Migración aplicada exitosamente');
            } else {
                console.log(`⚠️ Respuesta: ${res.statusCode}`);
                console.log('Datos:', data);
                console.log('\n📋 Por favor ejecuta manualmente desde Supabase SQL Editor:');
                console.log(sql);
            }
        });
    });

    req.on('error', (error) => {
        console.error('❌ Error:', error.message);
        console.log('\n📋 Por favor ejecuta manualmente desde Supabase SQL Editor:');
        console.log(sql);
    });

    req.write(postData);
    req.end();
}

applyMigration();
