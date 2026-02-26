'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';

export async function updateStudentAction(studentId: string, payload: any) {
    const supabase = await createClient();

    try {
        // 1. Get the current student and sale state before modifying
        const { data: oldStudent, error: oldStudentError } = await (supabase as any)
            .from('students')
            .select('*, sales(*)')
            .eq('id', studentId)
            .single();

        if (oldStudentError || !oldStudent) {
            return { success: false, error: 'Estudiante no encontrado' };
        }

        const oldSale = oldStudent.sales && oldStudent.sales.length > 0 ? oldStudent.sales[0] : null;

        // 2. Update the student record
        const { data: updatedStudent, error: updateError } = await (supabase as any)
            .from('students')
            .update(payload)
            .eq('id', studentId)
            .select()
            .single();

        if (updateError) {
            console.error('Failed to update student:', updateError);
            return { success: false, error: 'Failed to update student record' };
        }

        // 3. If price or pack changed, we MUST recalculate finances
        const priceChanged = oldStudent.agreed_price !== payload.agreed_price;
        const packChanged = oldStudent.pack_id !== payload.pack_id;
        const installmentsChanged = oldStudent.total_installments !== payload.total_installments;

        if (oldSale && (priceChanged || packChanged || installmentsChanged)) {
            // --- 3A. Update Sale ---
            const { error: saleError } = await (supabase as any)
                .from('sales')
                .update({
                    pack_id: payload.pack_id,
                    total_amount: payload.agreed_price
                })
                .eq('id', oldSale.id);

            if (saleError) {
                console.error('Failed to update sale:', saleError);
                return { success: false, error: 'Failed to update sale' };
            }

            // --- 3B. Identify Paid Amounts ---
            const { data: payments } = await (supabase as any)
                .from('payments')
                .select('*')
                .eq('student_id', studentId)
                .order('due_date', { ascending: true });

            const pastPayments: any[] = payments || [];
            // Consider a payment complete if it's 'paid'
            const collectedPayments = pastPayments.filter((p: any) => p.status === 'paid');
            const collectedAmount = collectedPayments.reduce((sum: number, p: any) => sum + Number(p.amount), 0);

            // --- 3C. Calculate Remaining Debt ---
            const newTotal = Number(payload.agreed_price);
            const remainingDebt = Math.max(0, newTotal - collectedAmount);

            // --- 3D. Purge Old Pending Payments ---
            const { error: purgeError } = await (supabase as any)
                .from('payments')
                .delete()
                .eq('student_id', studentId)
                .eq('status', 'pending');

            if (purgeError) {
                console.error('Failed to purge old pending payments:', purgeError);
                return { success: false, error: 'Failed to clear old pending installments' };
            }

            // --- 3E. Generate New Pending Installments (if applicable) ---
            if (payload.payment_method === 'installments' && payload.total_installments > 1 && remainingDebt > 0) {
                // How many installments do we have left to generate?
                // E.g. User wants 3 installments total. 1 is already paid. We need to generate 2.
                const paidCount = collectedPayments.length;
                const remainingInstallmentCount = Math.max(1, payload.total_installments - paidCount);

                // Re-divide the remaining debt over the remaining months
                const newInstallmentAmount = Number((remainingDebt / remainingInstallmentCount).toFixed(2));

                // To handle minor decimal drifting, adjust the last one
                const rawTotalGenerated = newInstallmentAmount * remainingInstallmentCount;
                const driftAdjustment = Number((remainingDebt - rawTotalGenerated).toFixed(2));

                const newPayments = [];
                const baseDate = new Date();

                for (let i = 0; i < remainingInstallmentCount; i++) {
                    const dueDate = new Date(baseDate);
                    // Move one month forward for each new pending installment
                    dueDate.setMonth(dueDate.getMonth() + (i + 1) * payload.installment_period);

                    let amount = newInstallmentAmount;
                    // Add the drift to the very last installment
                    if (i === remainingInstallmentCount - 1) {
                        amount = Number((amount + driftAdjustment).toFixed(2));
                    }

                    newPayments.push({
                        student_id: studentId,
                        amount: amount,
                        due_date: dueDate.toISOString().split('T')[0],
                        status: 'pending',
                        method: 'manual'
                    });
                }

                if (newPayments.length > 0) {
                    const { error: insertPaymentsError } = await (supabase as any)
                        .from('payments')
                        .insert(newPayments);

                    if (insertPaymentsError) {
                        console.error('Failed to insert new installments:', insertPaymentsError);
                        return { success: false, error: 'Failed to create new installments' };
                    }
                }
            } else if (remainingDebt > 0) {
                // It's upfront payment and they still owe money? Create 1 pending payment for the remainder.
                // (e.g., they upgraded from a 1000 pack to 2000 upfront)
                const { error: insertRemainderError } = await (supabase as any)
                    .from('payments')
                    .insert({
                        student_id: studentId,
                        amount: remainingDebt,
                        due_date: new Date().toISOString().split('T')[0],
                        status: 'pending',
                        method: 'manual'
                    });
                if (insertRemainderError) {
                    console.error('Failed to insert remainder payment:', insertRemainderError);
                    return { success: false, error: 'Failed to create remainder payment' };
                }
            }

        }

        revalidatePath('/admin/students');
        revalidatePath('/admin/payments');

        return { success: true, data: updatedStudent };
    } catch (e: any) {
        console.error('updateStudentAction error:', e);
        return { success: false, error: e.message || 'An unexpected error occurred' };
    }
}
