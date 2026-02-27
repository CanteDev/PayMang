import { SupabaseClient } from '@supabase/supabase-js';

/**
 * Marks pending installments (payments) for a student as 'paid' 
 * based on the amount received from a payment gateway webhook.
 * 
 * It iterates through chronological pending payments and marks them
 * as paid until the webhook amount is exhausted.
 */
/**
 * Marks pending installments (payments) for a student as 'paid' 
 * based on the amount received.
 * 
 * It iterates through chronological pending payments and marks them
 * as paid (or partially paid) until the received amount is exhausted.
 */
export async function syncPaymentToInstallments(
    supabase: SupabaseClient,
    studentId: string,
    saleId: string,
    amountReceived: number,
    gateway: string
) {
    if (!studentId || !saleId || amountReceived <= 0) return;

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
        return;
    }

    let remainingToCover = amountReceived;

    // 2. Iterate and consume pending installments
    if (pendingPayments && pendingPayments.length > 0) {
        for (const payment of pendingPayments) {
            if (remainingToCover <= 0.05) break;

            if (remainingToCover + 0.05 >= payment.amount) {
                // Full consumption of this installment
                const { error: updateError } = await (supabase
                    .from('payments') as any)
                    .update({
                        status: 'paid',
                        method: gateway,
                        paid_at: new Date().toISOString(),
                        updated_at: new Date().toISOString()
                    })
                    .eq('id', payment.id);

                if (updateError) {
                    console.error(`Error marking installment ${payment.id} as paid:`, updateError);
                } else {
                    remainingToCover -= payment.amount;
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
                const { error: insertError } = await (supabase
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
                    });

                if (insertError) {
                    console.error(`Error inserting partial paid record:`, insertError);
                }

                remainingToCover = 0;
                break; // Payment fully allocated
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
            due_date: new Date().toISOString().split('T')[0], // Use today for surplus
            method: gateway,
            paid_at: new Date().toISOString(),
            notes: gateway === 'manual' ? 'Pago manual excedente' : 'Excedente de pago / Pago sin cuota previa',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
        };

        const { error: insertError } = await (supabase
            .from('payments') as any)
            .insert(insertPayload);

        if (insertError) {
            console.error(`Failed to insert visual history record for student ${studentId}:`, insertError);
        } else {
            console.log(`✅ Inserted surplus ledger record of ${remainingToCover}€ for student ${studentId} via ${gateway}`);
        }
    }
}
