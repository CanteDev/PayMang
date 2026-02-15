import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, serviceRoleKey);

async function test() {
    console.log('1️⃣ Test: select(*) from students');
    const { data: d1, error: e1 } = await supabase.from('students').select('*').limit(5);
    if (e1) console.error('❌ Error 1:', e1.message);
    else console.log('✅ Success 1! Total:', d1.length);

    console.log('\n2️⃣ Test: select(*, coach:profiles!assigned_coach_id(full_name))');
    const { data: d2, error: e2 } = await supabase.from('students').select('*, coach:profiles!assigned_coach_id(full_name)').limit(5);
    if (e2) console.error('❌ Error 2:', e2.message);
    else console.log('✅ Success 2!');

    console.log('\n3️⃣ Test: select(*, payments(*))');
    const { data: d3, error: e3 } = await supabase.from('students').select('*, payments(*)').limit(5);
    if (e3) console.error('❌ Error 3:', e3.message);
    else console.log('✅ Success 3!');
}

test();
