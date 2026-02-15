'use server';

import { createClient } from '@/lib/supabase/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';
import { revalidatePath } from 'next/cache';

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
        // Update existing planned payment
        const { error } = await adminSupabase
            .from('payments')
            .update({
                status: 'paid',
                amount: data.amount,
                paid_at: new Date().toISOString(),
                due_date: data.date, // Update due_date to when it was actually paid if needed, or keep it? Usually better to keep due_date and use paid_at
                method: data.method,
                notes: data.notes
            })
            .eq('id', data.paymentId);

        if (error) return { error: error.message };
    } else {
        // Create new manual payment
        const { error } = await adminSupabase
            .from('payments')
            .insert({
                student_id: data.studentId,
                amount: data.amount,
                status: 'paid',
                due_date: data.date,
                paid_at: new Date().toISOString(),
                method: data.method,
                notes: data.notes || 'Pago Manual'
            });

        if (error) return { error: error.message };
    }

    revalidatePath('/admin/students');
    return { success: true };
}
