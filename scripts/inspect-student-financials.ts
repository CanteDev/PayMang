import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function inspectStudent(email: string) {
    console.log(`\n🔍 Inspecting student: ${email}`);

    // 1. Get Student
    const { data: student, error: studentError } = await supabase
        .from('students')
        .select('*, packs(id, name, price)')
        .eq('email', email)
        .single();

    if (studentError || !student) {
        console.error('Student not found:', studentError);
        return;
    }
    console.log('\n--- STUDENT RECORD ---');
    console.log({
        id: student.id,
        name: student.full_name,
        email: student.email,
        pack: student.packs?.name,
        agreed_price: student.agreed_price,
        total_installments: student.total_installments,
        installment_period: student.installment_period,
    });

    // 2. Get Sales
    const { data: sales } = await supabase
        .from('sales')
        .select('*')
        .eq('student_id', student.id);

    console.log('\n--- SALES RECORDS ---');
    console.log(sales?.map(s => ({
        id: s.id,
        pack_id: s.pack_id,
        total_amount: s.total_amount,
        amount_collected: s.amount_collected,
        status: s.status
    })));

    // 3. Get Payments
    const { data: payments } = await supabase
        .from('payments')
        .select('*')
        .eq('student_id', student.id)
        .order('created_at', { ascending: true });

    console.log('\n--- PAYMENTS RECORDS ---');
    console.log(payments?.map(p => ({
        id: p.id,
        amount: p.amount,
        status: p.status,
        method: p.method
    })));

    // 4. Get Installments
    const { data: installments } = await supabase
        .from('installments')
        .select('*')
        .eq('student_id', student.id)
        .order('due_date', { ascending: true });

    console.log('\n--- INSTALLMENTS RECORDS ---');
    console.log(installments?.map(i => ({
        id: i.id,
        amount: i.amount,
        status: i.status,
        due_date: i.due_date
    })));
}

inspectStudent('al9@mail.com');
