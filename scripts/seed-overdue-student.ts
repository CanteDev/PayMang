import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function seedOverdue() {
    let { data: std, error: stdErr } = await supabase.from('students').insert({
        full_name: `Moroso ${Date.now()}`,
        email: `moroso${Date.now()}@test.com`,
        status: 'active'
    }).select().single();

    let { data: pack } = await supabase.from('packs').select('id, price').limit(1).single();

    if (!pack) {
        console.log('No packs found, creating a dummy pack...');
        const { data: newPack, error: packErr } = await supabase.from('packs').insert({
            name: 'Dummy Pack',
            price: 1500,
            is_active: true
        }).select().single();

        if (packErr) {
            console.error('Failed to create dummy pack:', packErr);
            return;
        }
        pack = newPack;
    }

    if (!std) {
        console.error('Missing student');
        return;
    }

    const salePayload = {
        student_id: std.id,
        pack_id: pack!.id,
        gateway: 'manual',
        transaction_id: `test_${Date.now()}`,
        total_amount: pack!.price,
        amount_collected: 0,
        status: 'pending',
        payment_method: 'installments',
        total_installments: 3,
        installment_period: 1,
        start_date: new Date().toISOString()
    };

    const { data: sale, error } = await supabase.from('sales').insert(salePayload).select().single();
    if (error) {
        console.error('Failed to create sale:', error);
        return;
    }

    // Generate 1 Overdue Installment (due 5 days ago)
    const overdueDate = new Date();
    overdueDate.setDate(overdueDate.getDate() - 5);

    await supabase.from('payments').insert({
        student_id: std.id,
        sale_id: sale.id,
        amount: pack!.price / 3,
        due_date: overdueDate.toISOString().split('T')[0],
        status: 'pending', // Pending but past due date = overdue conceptually in dashboard
        method: 'manual',
    });

    // Generate 2 Future Installments
    const futureDate1 = new Date();
    futureDate1.setMonth(futureDate1.getMonth() + 1);

    await supabase.from('payments').insert({
        student_id: std.id,
        sale_id: sale.id,
        amount: pack!.price / 3,
        due_date: futureDate1.toISOString().split('T')[0],
        status: 'pending',
        method: 'manual',
    });

    const futureDate2 = new Date();
    futureDate2.setMonth(futureDate2.getMonth() + 2);

    await supabase.from('payments').insert({
        student_id: std.id,
        sale_id: sale.id,
        amount: pack!.price / 3,
        due_date: futureDate2.toISOString().split('T')[0],
        status: 'pending',
        method: 'manual',
    });

    console.log('✅ Overdue and Future payments generated for Dashboard check.');
}

seedOverdue();
