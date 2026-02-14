const { createClient } = require('@supabase/supabase-js');
const https = require('https');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

async function applyMigrationViaAPI() {
    console.log('🔧 Aplicando migración de gastos...');

    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const projectRef = 'rjspuxdvpdwescrvudgz'; // extracted from apply-migration-api.js

    const migrationPath = path.join(__dirname, 'migrations', '20260212160000_update_expenses_schema.sql');
    const sql = fs.readFileSync(migrationPath, 'utf8');

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

applyMigrationViaAPI();
