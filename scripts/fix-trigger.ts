import * as dotenv from 'dotenv';
dotenv.config();

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// Using the Supabase REST Admin endpoint for executing SQL
// This uses undocumented but working internal endpoints via PostgREST
async function execSQL(sql: string) {
    // 1. Try via /query path (some versions of supabase)
    const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/exec_sql`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'apikey': SERVICE_KEY,
            'Authorization': `Bearer ${SERVICE_KEY}`,
        },
        body: JSON.stringify({ sql })
    });
    const text = await res.text();
    console.log('exec_sql status:', res.status, text.slice(0, 200));
    return res.status < 400;
}

async function dropTriggerViaPGSQL() {
    // The most reliable way: Create temporary helper function in public schema
    // that uses SECURITY DEFINER to drop the trigger
    const createFn = `
    DROP FUNCTION IF EXISTS __tmp_drop_trigger();
    CREATE FUNCTION __tmp_drop_trigger()
    RETURNS void
    SECURITY DEFINER
    LANGUAGE plpgsql
    AS $$
    BEGIN
        EXECUTE 'DROP TRIGGER IF EXISTS trigger_create_installments ON students';
        EXECUTE 'DROP FUNCTION IF EXISTS create_installments_for_student() CASCADE';
    END;
    $$;
    `;

    // Try using pg-promise style via connection string
    // Extract connection details from Supabase URL
    const projectRef = SUPABASE_URL.split('//')[1].split('.')[0];
    const dbUrl = `postgresql://postgres:${encodeURIComponent(process.env.POSTGRES_PASSWORD || '')}@db.${projectRef}.supabase.co:5432/postgres`;

    console.log('Project ref:', projectRef);

    // Since we can't do direct DB connection, try using the pg endpoint
    const res2 = await fetch(`${SUPABASE_URL}/rest/v1/`, {
        method: 'GET',
        headers: {
            'apikey': SERVICE_KEY,
            'Authorization': `Bearer ${SERVICE_KEY}`,
        }
    });
    console.log('Root status:', res2.status);
    const schemas = await res2.json();
    console.log('Available paths (first 5):', JSON.stringify(Object.keys(schemas || {}).slice(0, 5)));
}

async function main() {
    await dropTriggerViaPGSQL();
}

main().catch(console.error);
