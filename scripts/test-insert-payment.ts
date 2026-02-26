import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
    const { data, error } = await supabase.from('payments').insert([{
        student_id: '154032d1-218f-4ed1-8d00-410a8ad6d013', // Real AL9 student ID from test scripts
        amount: 100,
        status: 'pending',
        due_date: '2026-03-01',
        method: 'manual'
    }]);
    console.log("Error:", error);
    console.log("Data:", data);
}
main();
