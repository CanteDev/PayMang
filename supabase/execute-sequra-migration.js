const https = require('https');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const projectUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!projectUrl || !serviceRoleKey) {
    console.error('Missing Supabase URL or Service Role Key');
    process.exit(1);
}

const migrationPath = path.join(__dirname, 'migrations', '20260213100000_add_sequra_fields.sql');
const sql = fs.readFileSync(migrationPath, 'utf8');

const projectRef = projectUrl.match(/https:\/\/(.+)\.supabase\.co/)[1];

const options = {
    hostname: 'api.supabase.com',
    port: 443,
    path: `/v1/projects/${projectRef}/database/query`,
    method: 'POST',
    headers: {
        'Authorization': `Bearer ${process.env.SUPABASE_ACCESS_TOKEN || serviceRoleKey}`, // Use service role if access token not avail, but for RPC typically service role is enough if using rest. Wait, this is Management API? 
        // The previous successful script used RPC 'exec_sql'. Let's stick to that pattern as it was successful.
        'Content-Type': 'application/json',
        'apikey': serviceRoleKey,
        'Authorization': `Bearer ${serviceRoleKey}`
    }
};

// Actually, the previous script `execute-expenses-migration.js` used the client's RPC endpoint, not the management API directly?
// Let me check `execute-expenses-migration.js` content again from logs or view it.
// I'll stick to the RPC method 'exec_sql' which we know works IF the function exists.
// User successfully ran `apply-migration-api.js` before?
// Let's look at `apply-migration.js`.
// I will rewrite this to use the standard `createClient` and `rpc` call which is cleaner.

// WAIT, the user's `execute-expenses-migration.js` used `https` module to call the RPC endpoint manually.
// I will replicate that EXACTLY to avoid issues.

const rpcUrl = `${projectUrl}/rest/v1/rpc/exec_sql`;
const rpcOptions = {
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
        'apikey': serviceRoleKey,
        'Authorization': `Bearer ${serviceRoleKey}`
    }
};

const req = https.request(rpcUrl, rpcOptions, (res) => {
    let data = '';

    res.on('data', (chunk) => {
        data += chunk;
    });

    res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
            console.log('Migration applied successfully.');
        } else {
            console.error('Error applying migration:', res.statusCode, data);
        }
    });
});

req.on('error', (e) => {
    console.error('Request error:', e);
});

req.write(JSON.stringify({ sql }));
req.end();
