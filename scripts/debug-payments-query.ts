import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, serviceRoleKey);

async function runFrontendQuery() {
    console.log('🚀 Simulating frontend query on all_transactions...');

    const { data, error, count } = await supabase
        .from('all_transactions')
        .select(`
        *,
        student:students(full_name, email),
        pack:packs(name)
    `, { count: 'exact' })
        .order('created_at', { ascending: false })
        .range(0, 19);

    if (error) {
        console.error('❌ Query Error:', error.message);
        return;
    }

    console.log(`✅ Result count: ${data?.length} (Total in DB: ${count})`);

    const manualPayments = data?.filter(t => t.type === 'manual');
    console.log(`📊 Manual payments in result: ${manualPayments?.length}`);

    if (manualPayments && manualPayments.length > 0) {
        console.log('📝 Sample manual payment record:');
        console.log(JSON.stringify(manualPayments[0], null, 2));
    } else {
        console.log('⚠️ No manual payments found in this batch.');
    }
}

runFrontendQuery();
