import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import path from 'path';

// Load env vars
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error("Missing Supabase credentials in .env.local");
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: {
        autoRefreshToken: false,
        persistSession: false
    }
});

async function clearData() {
    console.log('🧹 Starting deep clean of all test data...');

    try {
        // Note: Due to foreign key constraints with ON DELETE CASCADE (if configured),
        // deleting students might delete everything else. However, to be safe, we delete explicitly.

        console.log('Deleting all commissions...');
        await supabase.from('commissions').delete().neq('id', '00000000-0000-0000-0000-000000000000');

        console.log('Deleting all payments...');
        await supabase.from('payments').delete().neq('id', '00000000-0000-0000-0000-000000000000');

        console.log('Deleting all payment links...');
        await supabase.from('payment_links').delete().neq('id', '0');

        console.log('Deleting all sales...');
        await supabase.from('sales').delete().neq('id', '00000000-0000-0000-0000-000000000000');

        console.log('Deleting all students...');
        await supabase.from('students').delete().neq('id', '00000000-0000-0000-0000-000000000000');

        console.log('✅ All test data cleared successfully!');
    } catch (error) {
        console.error('❌ Error clearing data:', error);
    }
}

clearData();
