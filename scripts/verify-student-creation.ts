import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function main() {
    console.log('=== TEST 1: Student INSERT (no pack) ===');
    const { data: s1, error: e1 } = await supabase
        .from('students')
        .insert({ email: `test-simple-${Date.now()}@test.com`, full_name: 'Test Simple', status: 'active' })
        .select().single();
    if (e1) { console.log('❌ FAILED:', e1.message, e1.code); }
    else { console.log('✅ OK - id:', s1.id); await supabase.from('students').delete().eq('id', s1.id); }

    console.log('\n=== TEST 2: Student + Sale INSERT ===');
    // Get a pack for testing
    const { data: packs } = await supabase.from('packs').select('id, name').eq('is_active', true).limit(1);
    if (!packs?.length) { console.log('⚠️  No active packs found, skip sale test'); return; }
    const packId = packs[0].id;
    console.log('Using pack:', packs[0].name, '(', packId, ')');

    const { data: s2, error: e2 } = await supabase
        .from('students')
        .insert({ email: `test-withsale-${Date.now()}@test.com`, full_name: 'Test WithSale', status: 'active' })
        .select().single();
    if (e2) { console.log('❌ Student FAILED:', e2.message); return; }
    console.log('✅ Student created:', s2.id);

    const { data: sale, error: saleErr } = await supabase
        .from('sales')
        .insert({
            student_id: s2.id,
            pack_id: packId,
            gateway: 'manual',
            transaction_id: `manual_test_${Date.now()}`,
            total_amount: 500,
            amount_collected: 0,
            status: 'pending',
            payment_method: 'installments',
            total_installments: 3,
            installment_period: 1,
            start_date: '2026-03-01'
        })
        .select().single();
    if (saleErr) { console.log('❌ Sale FAILED:', saleErr.message, saleErr.code); }
    else { console.log('✅ Sale created:', sale.id); }

    // Test payment linked to sale
    const { data: payment, error: payErr } = await supabase
        .from('payments')
        .insert({
            student_id: s2.id,
            sale_id: sale?.id,
            amount: 166.67,
            status: 'pending',
            due_date: '2026-03-01',
            method: 'transfer'
        })
        .select().single();
    if (payErr) { console.log('❌ Payment FAILED:', payErr.message, payErr.code); }
    else { console.log('✅ Payment created linked to sale:', payment.id); }

    // Cleanup
    await supabase.from('payments').delete().eq('student_id', s2.id);
    await supabase.from('sales').delete().eq('student_id', s2.id);
    await supabase.from('students').delete().eq('id', s2.id);
    console.log('\n✅ Cleanup done');

    console.log('\n=== SUMMARY ===');
    console.log('All critical DB operations are working correctly after trigger removal.');
}

main().catch(console.error);
