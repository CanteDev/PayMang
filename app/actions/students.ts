'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';

export async function updateStudentAction(studentId: string, payload: any) {
    const supabase = await createClient();

    try {
        // 1. Get the current student
        const { data: oldStudent, error: oldStudentError } = await (supabase as any)
            .from('students')
            .select('*')
            .eq('id', studentId)
            .single();

        if (oldStudentError || !oldStudent) {
            return { success: false, error: 'Estudiante no encontrado' };
        }

        // 2. Update the student record (only profile fields allowed now)
        const profilePayload = {
            email: payload.email,
            full_name: payload.full_name,
            phone: payload.phone,
            assigned_coach_id: payload.assigned_coach_id,
            closer_id: payload.closer_id,
            setter_id: payload.setter_id,
            status: payload.status
        };

        const { data: updatedStudent, error: updateError } = await (supabase as any)
            .from('students')
            .update(profilePayload)
            .eq('id', studentId)
            .select()
            .single();

        if (updateError) {
            console.error('Failed to update student:', updateError);
            return { success: false, error: 'Failed to update student record' };
        }

        revalidatePath('/admin/students');
        revalidatePath('/admin/payments');

        return { success: true, data: updatedStudent };
    } catch (e: any) {
        console.error('updateStudentAction error:', e);
        return { success: false, error: e.message || 'An unexpected error occurred' };
    }
}

export async function createStudentAction(payload: any, salePayload?: any) {
    const supabase = await createClient();

    try {
        // 1. Create the student record
        const profilePayload = {
            email: payload.email,
            full_name: payload.full_name,
            phone: payload.phone,
            assigned_coach_id: payload.assigned_coach_id,
            closer_id: payload.closer_id,
            setter_id: payload.setter_id,
            status: payload.status
        };

        const { data: newStudent, error: insertError } = await (supabase as any)
            .from('students')
            .insert(profilePayload)
            .select()
            .single();

        if (insertError) {
            console.error('Failed to create student:', insertError);
            return { success: false, error: 'Failed to create student record' };
        }

        // 2. If a pack is selected, create the initial sale and payments
        if (salePayload && salePayload.pack_id) {
            const saleData = {
                student_id: newStudent.id,
                pack_id: salePayload.pack_id,
                gateway: 'manual', // or whichever default
                transaction_id: `manual_${Date.now()}`,
                total_amount: salePayload.agreed_price,
                amount_collected: 0,
                status: 'pending',
                payment_method: salePayload.payment_method,
                total_installments: salePayload.total_installments,
                installment_period: salePayload.installment_period,
                start_date: salePayload.start_date
            };

            const { data: newSale, error: saleError } = await (supabase as any)
                .from('sales')
                .insert(saleData)
                .select()
                .single();

            if (saleError) {
                console.error('Failed to create initial sale:', saleError);
                // Return success for student but with warning
                return { success: true, data: newStudent, warning: 'Student created but failed to create sale' };
            }

            // 3. Generate initial pending installments
            const debt = salePayload.agreed_price;
            if (debt > 0) {
                const totalInstallments = salePayload.payment_method === 'installments' ? salePayload.total_installments : 1;
                const installmentAmount = Number((debt / totalInstallments).toFixed(2));
                const driftAdjustment = Number((debt - (installmentAmount * totalInstallments)).toFixed(2));

                const newPayments = [];
                const baseDate = new Date(salePayload.start_date || new Date().toISOString());

                for (let i = 0; i < totalInstallments; i++) {
                    const dueDate = new Date(baseDate);
                    // First payment is due on start_date (0 offset), subsequent payments based on period
                    dueDate.setMonth(dueDate.getMonth() + (i * salePayload.installment_period));

                    let amount = installmentAmount;
                    if (i === totalInstallments - 1) {
                        amount = Number((amount + driftAdjustment).toFixed(2));
                    }

                    newPayments.push({
                        student_id: newStudent.id,
                        sale_id: newSale.id, // Explicitly linking to sale
                        amount: amount,
                        due_date: dueDate.toISOString().split('T')[0],
                        status: 'pending',
                        method: 'manual'
                    });
                }

                if (newPayments.length > 0) {
                    const { error: paymentsError } = await (supabase as any)
                        .from('payments')
                        .insert(newPayments);

                    if (paymentsError) {
                        console.error('Failed to create initial installments:', paymentsError);
                    }
                }
            }
        }

        revalidatePath('/admin/students');
        return { success: true, data: newStudent };
    } catch (e: any) {
        console.error('createStudentAction error:', e);
        return { success: false, error: e.message || 'An unexpected error occurred' };
    }
}
