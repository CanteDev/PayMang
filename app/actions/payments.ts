'use server';

import { createClient } from '@/lib/supabase/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';
import { revalidatePath } from 'next/cache';
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
                method: data.method,
                notes: data.notes
            })
            .eq('id', data.paymentId);

        if (error) return { error: error.message };

        // Generate commissions for this payment
        await generateManualCommissions(adminSupabase, data.studentId, data.amount, data.paymentId, false);
    } else {
        // Create new manual payment
        const { data: newPayment, error } = await adminSupabase
            .from('payments')
            .insert({
                student_id: data.studentId,
                amount: data.amount,
                status: 'paid',
                due_date: data.date,
                paid_at: new Date().toISOString(),
                method: data.method,
                notes: data.notes || 'Pago Manual'
            })
            .select()
            .single();

        if (error) return { error: error.message };
        if (newPayment) {
            await generateManualCommissions(adminSupabase, data.studentId, data.amount, newPayment.id, true);
        }
    }

    revalidatePath('/admin');
    revalidatePath('/admin/students');
    revalidatePath('/admin/payments');
    return { success: true };
}

async function generateManualCommissions(supabase: any, studentId: string, amount: number, paymentId: string, isNew: boolean) {
    // 1. Get student info to find agents and pack
    const { data: student } = await supabase
        .from('students')
        .select('assigned_coach_id, closer_id, setter_id, pack_id')
        .eq('id', studentId)
        .single();

    if (!student) {
        console.error('[generateManualCommissions] Student not found:', studentId);
        return;
    }

    const commissions: any[] = [];

    // Calculate for Coach
    if (student.assigned_coach_id) {
        const commAmount = await calculateCommission(amount, 'coach');
        if (commAmount > 0) {
            commissions.push({
                payment_id: paymentId,
                sale_id: null,
                agent_id: student.assigned_coach_id,
                role_at_sale: 'coach',
                amount: commAmount,
                status: 'pending'
            });
        }
    }

    // Calculate for Closer
    if (student.closer_id) {
        const commAmount = await calculateCommission(amount, 'closer');
        if (commAmount > 0) {
            commissions.push({
                payment_id: paymentId,
                sale_id: null,
                agent_id: student.closer_id,
                role_at_sale: 'closer',
                amount: commAmount,
                status: 'pending'
            });
        }
    }

    // Calculate for Setter
    if (student.setter_id) {
        const commAmount = await calculateCommission(amount, 'setter');
        if (commAmount > 0) {
            commissions.push({
                payment_id: paymentId,
                sale_id: null,
                agent_id: student.setter_id,
                role_at_sale: 'setter',
                amount: commAmount,
                status: 'pending'
            });
        }
    }

    if (commissions.length > 0) {
        const { error } = await supabase.from('commissions').insert(commissions);
        if (error) {
            console.error('[generateManualCommissions] Error inserting commissions:', error.message, JSON.stringify(commissions));
        } else {
            console.log(`[generateManualCommissions] Created ${commissions.length} commissions for payment ${paymentId}`);
        }
    } else {
        console.warn('[generateManualCommissions] No commissions generated - check agent assignments for student:', studentId);
    }
}

