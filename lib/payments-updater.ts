import { SupabaseClient } from '@supabase/supabase-js';

export interface SyncPaymentResult {
    /** ID del primer pago marcado como pagado (compatibilidad versiones anteriores) */
    id: string;
    /** IDs de TODOS los pagos marcados como pagados en esta sincronización */
    allIds: string[];
}

/**
 * Marks pending installments (payments) for a student as 'paid' 
 * based on the amount received from a payment gateway webhook.
 * 
 * Returns ALL payment IDs that were marked as paid so that the caller
 * (webhook handler) can stamp the same external_id on all of them,
 * preventing duplicate rows in the Payments admin view.
 */
export async function syncPaymentToInstallments(
    supabase: SupabaseClient,
    studentId: string,
    saleId: string,
    amountReceived: number,
    gateway: string
): Promise<SyncPaymentResult | null> {
    if (!studentId || !saleId || amountReceived <= 0) return null;

    // 0. Update the sale's collected amount
    const { data: sale } = await (supabase
        .from('sales') as any)
        .select('amount_collected')
        .eq('id', saleId)
        .single();

    if (sale) {
        await (supabase
            .from('sales') as any)
            .update({ amount_collected: Number(sale.amount_collected || 0) + Number(amountReceived) })
            .eq('id', saleId);
    }

    // 1. Fetch pending payments for THIS specific sale ordered by due date
    const { data: pendingPayments, error: fetchError } = await (supabase
        .from('payments') as any)
        .select('*')
        .eq('student_id', studentId)
        .eq('sale_id', saleId)
        .eq('status', 'pending')
        .order('due_date', { ascending: true });

    if (fetchError) {
        console.error(`Error fetching pending payments:`, fetchError);
        return null;
    }

    let remainingToCover = amountReceived;
    let mainPaymentRecord: SyncPaymentResult | null = null;
    const allMarkedIds: string[] = [];

    // 2. Iterate and consume pending installments
    if (pendingPayments && pendingPayments.length > 0) {
        for (const payment of pendingPayments) {
            if (remainingToCover <= 0.05) break;

            if (remainingToCover + 0.05 >= payment.amount) {
                // Full consumption of this installment
                const { data, error: updateError } = await (supabase
                    .from('payments') as any)
                    .update({
                        status: 'paid',
                        method: gateway,
                        paid_at: new Date().toISOString(),
                        updated_at: new Date().toISOString()
                    })
                    .eq('id', payment.id)
                    .select('id')
                    .single();

                if (updateError) {
                    console.error(`Error marking installment ${payment.id} as paid:`, updateError);
                } else {
                    remainingToCover -= payment.amount;
                    allMarkedIds.push(data.id);
                    if (!mainPaymentRecord) mainPaymentRecord = { id: data.id, allIds: [] };
                }
            } else {
                // Partial consumption: Split the installment
                // A. Reduce the amount of the existing pending installment
                const newPendingAmount = Number((payment.amount - remainingToCover).toFixed(2));
                const { error: updateError } = await (supabase
                    .from('payments') as any)
                    .update({
                        amount: newPendingAmount,
                        updated_at: new Date().toISOString()
                    })
                    .eq('id', payment.id);

                if (updateError) {
                    console.error(`Error updating pending installment ${payment.id}:`, updateError);
                    break;
                }

                // B. Create a new PAID record for the amount actually received now
                const { data, error: insertError } = await (supabase
                    .from('payments') as any)
                    .insert({
                        student_id: studentId,
                        sale_id: saleId,
                        amount: remainingToCover,
                        status: 'paid',
                        due_date: payment.due_date,
                        method: gateway,
                        paid_at: new Date().toISOString(),
                        notes: `Pago parcial de cuota (Vence: ${payment.due_date})`,
                        created_at: new Date().toISOString(),
                        updated_at: new Date().toISOString()
                    })
                    .select('id')
                    .single();

                if (insertError) {
                    console.error(`Error inserting partial paid record:`, insertError);
                } else {
                    allMarkedIds.push(data.id);
                    if (!mainPaymentRecord) mainPaymentRecord = { id: data.id, allIds: [] };
                }

                remainingToCover = 0;
                break;
            }
        }
    }

    // 3. Create an 'orphan' paid installment for any remaining SURPLUS amount.
    if (remainingToCover > 0.05) {
        const insertPayload = {
            student_id: studentId,
            sale_id: saleId,
            amount: remainingToCover,
            status: 'paid',
            due_date: new Date().toISOString().split('T')[0],
            method: gateway,
            paid_at: new Date().toISOString(),
            notes: gateway === 'manual' ? 'Pago manual excedente' : 'Excedente de pago / Pago sin cuota previa',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
        };

        const { data, error: insertError } = await (supabase
            .from('payments') as any)
            .insert(insertPayload)
            .select('id')
            .single();

        if (insertError) {
            console.error(`Failed to insert visual history record for student ${studentId}:`, insertError);
        } else {
            console.log(`✅ Inserted surplus ledger record of ${remainingToCover}€ for student ${studentId} via ${gateway}`);
            allMarkedIds.push(data.id);
            if (!mainPaymentRecord) mainPaymentRecord = { id: data.id, allIds: [] };
        }
    }

    if (mainPaymentRecord) {
        mainPaymentRecord.allIds = allMarkedIds;
    }

    return mainPaymentRecord;
}
