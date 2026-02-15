import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, serviceRoleKey);

async function listAllTables() {
    console.log('🔍 Listing all tables in public schema...');

    // We can't always use rpc if it's not predefined.
    // But we can try to guess or use the information_schema via standard REST if possible.
    // Actually, Supabase REST API doesn't expose information_schema by default.

    // Let's try to fetch a few common ones to see what exists.
    const commonTables = ['students', 'payments', 'sales', 'commissions', 'profiles', 'packs'];

    for (const table of commonTables) {
        const { data, error } = await supabase.from(table).select('*').limit(0);
        if (error) {
            console.log(`❌ ${table}: ${error.message}`);
        } else {
            console.log(`✅ ${table}: Exists`);
        }
    }
}

listAllTables();
