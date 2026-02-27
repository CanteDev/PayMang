import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function checkConstraint() {
    const { data, error } = await supabase.rpc('get_table_constraints', { table_name: 'payments' });
    if (error) {
        console.error('RPC Error (might not exist):', error);

        // Let's just try to insert a fake row with random methods to see which one passes
        const methodsToTest = ['transfer', 'manual', 'stripe', 'hotmart', 'cash', 'other'];
        for (const m of methodsToTest) {
            const { error: err } = await supabase.from('payments').insert({
                student_id: '00000000-0000-0000-0000-000000000000', // Fake ID (will fail FK)
                amount: 10,
                status: 'pending',
                method: m
            });
            console.log(`Method '${m}' failed with:`, err?.message || 'Success?');
        }
    } else {
        console.log(data);
    }
}
checkConstraint();
