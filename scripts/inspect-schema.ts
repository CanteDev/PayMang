import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, serviceRoleKey);

async function inspectSchema() {
    console.log('🔍 Inspecting Students columns...');
    const { data: sCols, error: sErr } = await supabase.from('students').select('*').limit(1);
    if (sErr) console.error('❌ Error students:', sErr.message);
    else console.log('✅ Students columns:', Object.keys(sCols[0] || {}));

    console.log('\n🔍 Inspecting Payments columns...');
    const { data: pCols, error: pErr } = await supabase.from('payments').select('*').limit(1);
    if (pErr) console.error('❌ Error payments:', pErr.message);
    else console.log('✅ Payments columns:', Object.keys(pCols[0] || {}));
}

inspectSchema();
