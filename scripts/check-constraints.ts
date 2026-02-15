import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, serviceRoleKey);

async function checkConstraints() {
    console.log('🔍 Checking constraints for table: payments');

    // Query information_schema for foreign keys
    const { data, error } = await supabase.rpc('get_table_constraints', { t_name: 'payments' });

    // If rpc doesn't exist, we can try a raw SQL via a known table if possible, 
    // but in Supabase we usually don't have raw SQL access from the client unless we created a function.

    // Let's try to fetch from a system table if RLS allows (usually not for anon)
    // But we have Service Role!
    const { data: constraints, error: cErr } = await supabase
        .from('information_schema.key_column_usage')
        .select('*')
        .eq('table_name', 'payments');

    if (cErr) {
        console.log('❌ Could not access information_schema directly:', cErr.message);

        // Fallback: try to just create a dummy record to see if FK fails
        console.log('🧪 Testing FK by inserting dummy payment with invalid student_id...');
        const { error: insErr } = await supabase
            .from('payments')
            .insert({
                student_id: '00000000-0000-0000-0000-000000000000',
                amount: 10,
                due_date: new Date().toISOString()
            });

        if (insErr) {
            console.log('✅ FK Constraint seems to exist (Insert failed as expected):', insErr.message);
        } else {
            console.log('⚠️ Insert SUCCEEDED with invalid UUID? This is BAD. FK is MISSING.');
        }
    } else {
        console.log('✅ Constraints found:', constraints.map(c => c.constraint_name));
    }
}

checkConstraints();
