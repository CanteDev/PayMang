import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, serviceRoleKey);

async function check() {
    console.log('--- RAW PAYMENTS (PAID) ---');
    const { data: pData, error: pErr } = await supabase.from('payments').select('*').eq('status', 'paid');
    if (pErr) console.error('Error p:', pErr.message);
    else console.log('Payments count:', pData.length, pData.map(p => ({ id: p.id, amount: p.amount })));

    console.log('\n--- ALL_TRANSACTIONS VIEW ---');
    const { data: tData, error: tErr } = await supabase.from('all_transactions').select('*');
    if (tErr) console.error('Error t:', tErr.message);
    else console.log('Transactions count:', tData.length);
}

check();
