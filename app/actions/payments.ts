'use server';

import { createClient } from '@/lib/supabase/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';
import { revalidatePath } from 'next/cache';
import { syncPaymentToInstallments } from '@/lib/payments-updater';
import { calculateCommission } from '@/lib/commissions/calculator';

/**
 * Helper to get Service Role Client
 */
function getSupabaseAdmin() {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    if (!serviceRoleKey) throw new Error('SERVICE_ROLE_KEY missing');
    return createAdminClient(supabaseUrl, serviceRoleKey);
}

interface RegisterPaymentData {
    studentId: string;
    saleId: string; // The specific pack/sale this payment applies to
    amount: number;
    date: string;
    method: string;
    notes?: string;
    paymentId?: string; // If we are updating an existing planned payment
}

export async function registerPayment(data: RegisterPaymentData) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) return { error: 'No autorizado' };

    // Verify admin role
    const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single();

    if (!profile || (profile as any).role !== 'admin') {
        return { error: 'Requiere permisos de administrador' };
    }

    const adminSupabase = getSupabaseAdmin();

    if (data.paymentId) {
        // 1. Update existing planned payment
        const { error } = await adminSupabase
            .from('payments')
            .update({
                status: 'paid',
                amount: data.amount,
                paid_at: new Date().toISOString(),
                method: data.method,
                notes: data.notes
            })
            .eq('id', data.paymentId);

        if (error) return { error: error.message };

        // 2. Update amount_collected for the sale
        const { data: saleData } = await adminSupabase
            .from('sales')
            .select('amount_collected')
            .eq('id', data.saleId)
            .single();

        if (saleData) {
            await adminSupabase
                .from('sales')
                .update({ amount_collected: Number(saleData.amount_collected || 0) + Number(data.amount) })
                .eq('id', data.saleId);
        }
    } else {
        // Use the centralized synchronizer for generic manual payments
        // This handles matching it to existing pending installments (partial fill)
        // and updating sales.amount_collected.
        await syncPaymentToInstallments(adminSupabase, data.studentId, data.saleId, data.amount, data.method || 'manual');
    }

    revalidatePath('/admin');
    revalidatePath('/admin/students');
    revalidatePath('/admin/payments');
    return { success: true };
}
