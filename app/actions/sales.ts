'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';

/**
 * Creates a new sale for an existing student and generates its payment plan
 */
export async function createSaleAction(studentId: string, salePayload: any) {
    const supabase = await createClient();

    try {
        const saleData = {
            student_id: studentId,
            pack_id: salePayload.pack_id,
            gateway: 'manual',
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
            console.error('Failed to create sale:', saleError);
            return { success: false, error: 'Failed to create sale' };
        }

        // Generate initial pending installments
        const debt = salePayload.agreed_price;
        if (debt > 0) {
            const totalInstallments = salePayload.payment_method === 'installments' ? salePayload.total_installments : 1;
            const installmentAmount = Number((debt / totalInstallments).toFixed(2));
            const driftAdjustment = Number((debt - (installmentAmount * totalInstallments)).toFixed(2));

            const newPayments = [];
            const baseDate = new Date(salePayload.start_date || new Date().toISOString());

            for (let i = 0; i < totalInstallments; i++) {
                const dueDate = new Date(baseDate);
                dueDate.setMonth(dueDate.getMonth() + (i * salePayload.installment_period));

                let amount = installmentAmount;
                if (i === totalInstallments - 1) {
                    amount = Number((amount + driftAdjustment).toFixed(2));
                }

                newPayments.push({
                    student_id: studentId,
                    sale_id: newSale.id,
                    amount: amount,
                    due_date: dueDate.toISOString().split('T')[0],
                    status: 'pending',
                    method: null
                });
            }

            if (newPayments.length > 0) {
                const { error: paymentsError } = await (supabase as any)
                    .from('payments')
                    .insert(newPayments);

                if (paymentsError) {
                    console.error('Failed to create installments:', paymentsError);
                    return { success: false, error: 'Venta creada pero falló la generación de cuotas: ' + paymentsError.message };
                }
            }
        }

        revalidatePath('/admin/students');
        return { success: true, data: newSale };
    } catch (e: any) {
        console.error('createSaleAction error:', e);
        return { success: false, error: e.message || 'An unexpected error occurred' };
    }
}

/**
 * Updates an existing sale and intelligently recalculates future installments
 */
export async function updateSaleAction(saleId: string, payload: any) {
    const supabase = await createClient();

    try {
        // 1. Get the current sale
        const { data: sale, error: saleError } = await (supabase as any)
            .from('sales')
            .select('*')
            .eq('id', saleId)
            .single();

        if (saleError || !sale) {
            return { success: false, error: 'Venta no encontrada' };
        }

        // 2. Identify already paid amount for this sale
        const { data: payments } = await (supabase as any)
            .from('payments')
            .select('amount, status')
            .eq('sale_id', saleId);

        const amountPaid = (payments || [])
            .filter((p: any) => p.status === 'paid')
            .reduce((sum: number, p: any) => sum + Number(p.amount), 0);

        // 3. Calculate remaining debt
        const newTotalAmount = Number(payload.agreed_price);
        const remainingDebt = Number((newTotalAmount - amountPaid).toFixed(2));

        // 4. Purge old pending installments
        const { error: deleteError } = await (supabase as any)
            .from('payments')
            .delete()
            .eq('sale_id', saleId)
            .eq('status', 'pending');

        if (deleteError) {
            console.error('Failed to purge old installments:', deleteError);
        }

        // 5. Generate new installments for remaining debt if any
        if (remainingDebt > 0) {
            const totalPlannedInstallments = payload.payment_method === 'installments' ? Number(payload.total_installments) : 1;
            const paidInstallmentsCount = (payments || []).filter((p: any) => p.status === 'paid').length;

            const remainingInstallmentsCount = Math.max(1, totalPlannedInstallments - paidInstallmentsCount);

            const installmentAmount = Number((remainingDebt / remainingInstallmentsCount).toFixed(2));
            const driftAdjustment = Number((remainingDebt - (installmentAmount * remainingInstallmentsCount)).toFixed(2));

            const newPayments = [];

            // Resume dates from the next available slot
            const baseDate = new Date(payload.start_date || sale.start_date);

            for (let i = 0; i < remainingInstallmentsCount; i++) {
                const dueDate = new Date(baseDate);
                // We offset by the number of already paid installments to keep the original schedule sequence if possible
                dueDate.setMonth(dueDate.getMonth() + ((paidInstallmentsCount + i) * Number(payload.installment_period || sale.installment_period)));

                let amount = installmentAmount;
                if (i === remainingInstallmentsCount - 1) {
                    amount = Number((amount + driftAdjustment).toFixed(2));
                }

                newPayments.push({
                    student_id: sale.student_id,
                    sale_id: saleId,
                    amount: amount,
                    due_date: dueDate.toISOString().split('T')[0],
                    status: 'pending',
                    method: null
                });
            }

            if (newPayments.length > 0) {
                const { error: insertError } = await (supabase as any)
                    .from('payments')
                    .insert(newPayments);

                if (insertError) {
                    console.error('Failed to create new installments:', insertError);
                }
            }
        }

        // 6. Update the sale record
        const { data: updatedSale, error: updateError } = await (supabase as any)
            .from('sales')
            .update({
                pack_id: payload.pack_id,
                total_amount: newTotalAmount,
                payment_method: payload.payment_method,
                total_installments: payload.total_installments,
                installment_period: payload.installment_period,
                start_date: payload.start_date
            })
            .eq('id', saleId)
            .select()
            .single();

        if (updateError) {
            return { success: false, error: 'Failed to update sale record' };
        }

        revalidatePath('/admin/students');
        return { success: true, data: updatedSale };
    } catch (e: any) {
        console.error('updateSaleAction error:', e);
        return { success: false, error: e.message || 'An unexpected error occurred' };
    }
}

/**
 * Deletes a sale, its pending installments, and associated commissions.
 * It does NOT delete successful payments or gateway webhooks.
 */
export async function deleteSaleAction(saleId: string) {
    const supabase = await createClient();

    try {
        // Find sale
        const { data: sale, error: saleError } = await (supabase as any)
            .from('sales')
            .select('student_id')
            .eq('id', saleId)
            .single();

        if (saleError || !sale) {
            return { success: false, error: 'Sale not found' };
        }

        // Delete pending payments associated with this sale
        const { error: paymentsError } = await (supabase as any)
            .from('payments')
            .delete()
            .eq('sale_id', saleId)
            .eq('status', 'pending');

        if (paymentsError) {
            console.error('Failed to delete pending installments:', paymentsError);
        }

        // Delete the sale itself
        const { error: deleteError } = await (supabase as any)
            .from('sales')
            .delete()
            .eq('id', saleId);

        if (deleteError) {
            return { success: false, error: 'Failed to delete sale record' };
        }

        revalidatePath('/admin/students');
        return { success: true };
    } catch (e: any) {
        console.error('deleteSaleAction error:', e);
        return { success: false, error: e.message || 'An unexpected error occurred' };
    }
}
