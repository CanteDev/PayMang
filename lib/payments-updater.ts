import { SupabaseClient } from '@supabase/supabase-js';

/**
 * Marks pending installments (payments) for a student as 'paid' 
 * based on the amount received from a payment gateway webhook.
 * 
 * It iterates through chronological pending payments and marks them
 * as paid until the webhook amount is exhausted.
 */
export async function syncGatewayPaymentToInstallments(
    supabase: SupabaseClient,
    studentId: string,
    amountReceived: number,
    gateway: string
) {
    if (!studentId || amountReceived <= 0) return;

    // 1. Fetch all pending payments for this student ordered by due date
    const { data: pendingPayments, error: fetchError } = await (supabase
        .from('payments') as any)
        .select('*')
        .eq('student_id', studentId)
        .eq('status', 'pending')
        .order('due_date', { ascending: true });

    if (fetchError || !pendingPayments || pendingPayments.length === 0) {
        console.warn(`No pending payments found for student ${studentId} to cover ${amountReceived} from ${gateway}`);
        return;
    }

    let remainingToCover = amountReceived;
    const updates = [];

    // 2. Iterate and mark as paid
    for (const payment of pendingPayments) {
        if (remainingToCover <= 0.05) break; // Close enough

        // If the remaining received amount can cover this entire payment (allowing a tiny 5-cent variance for rounding)
        if (remainingToCover + 0.05 >= payment.amount) {
            updates.push({
                ...payment,
                status: 'paid',
                method: gateway,
                paid_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            });
            remainingToCover -= payment.amount;
        } else {
            // Partially paid? The codebase seems to only handle 'pending' or 'paid' fully. 
            // In a simple model, we do not mark it paid unless fully covered.
            // We break here since we can't fully cover the next installment.
            break;
        }
    }

    // 3. Persist updates
    if (updates.length > 0) {
        const { error: updateError } = await (supabase
            .from('payments') as any)
            .upsert(updates);

        if (updateError) {
            console.error(`Failed to update installments as paid for student ${studentId}:`, updateError);
        } else {
            console.log(`✅ Marked ${updates.length} installments as paid for student ${studentId} via ${gateway}`);
        }
    }
}
