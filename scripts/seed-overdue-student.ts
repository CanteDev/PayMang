import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, serviceRoleKey);

async function seed() {
    console.log('🌱 Seeding overdue student...');

    // 1. Get a pack
    const { data: packs } = await supabase.from('packs').select('id, price').limit(1);
    if (!packs || packs.length === 0) {
        console.error('No packs found');
        return;
    }
    const pack = packs[0];

    // 2. Create student
    const enrollmentDate = new Date();
    enrollmentDate.setMonth(enrollmentDate.getMonth() - 2);
    const enrollmentStr = enrollmentDate.toISOString().split('T')[0];

    const { data: student, error: stError } = await supabase
        .from('students')
        .insert({
            email: `overdue_${Date.now()}@test.com`,
            full_name: 'Alumno Moroso Test',
            status: 'active',
            pack_id: pack.id,
            agreed_price: 1500,
            payment_method: 'installments',
            total_installments: 3,
            installment_period: 1,
            start_date: enrollmentStr
        })
        .select()
        .single();

    if (stError) {
        console.error('Error creating student:', stError.message);
        return;
    }

    console.log('✅ Student created:', student.id);

    // 3. Create payments (Triggers might have created them, let's check)
    // Actually, I'll delete any auto-generated ones and create custom ones for exact test case
    await supabase.from('payments').delete().eq('student_id', student.id);

    const payments = [
        {
            student_id: student.id,
            amount: 500,
            status: 'paid',
            due_date: enrollmentStr,
            paid_at: enrollmentStr,
            method: 'transfer',
            notes: 'Primera cuota pagada a tiempo'
        },
        {
            student_id: student.id,
            amount: 500,
            status: 'pending',
            due_date: new Date(enrollmentDate.getFullYear(), enrollmentDate.getMonth() + 1, enrollmentDate.getDate()).toISOString().split('T')[0],
            notes: 'Segunda cuota VENCIDA'
        },
        {
            student_id: student.id,
            amount: 500,
            status: 'pending',
            due_date: new Date(enrollmentDate.getFullYear(), enrollmentDate.getMonth() + 2, enrollmentDate.getDate()).toISOString().split('T')[0],
            notes: 'Tercera cuota PENDIENTE (hoy)'
        }
    ];

    const { error: payError } = await supabase.from('payments').insert(payments);
    if (payError) {
        console.error('Error creating payments:', payError.message);
    } else {
        console.log('✅ 3 installments created (1 paid, 2 pending/overdue)');
    }
}

seed();
