import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, serviceRoleKey);

console.log('🧪 Testing valid payload...');
const { error: insErr, data: data2 } = await supabase
    .from('payments')
    .insert({
        student_id: '154032d1-218f-4ed1-8d00-410a8ad6d013', // AL9
        amount: 100,
        status: 'pending',
        due_date: '2026-04-01',
        method: 'manual'
    });

if (insErr) {
    console.log('✅ Error:', insErr);
} else {
    console.log('⚠️ Success');
}
