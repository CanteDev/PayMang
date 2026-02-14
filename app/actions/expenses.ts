'use server';

import { createClient } from '@/lib/supabase/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';
import { revalidatePath } from 'next/cache';
import { Expense } from '@/types/database';

/**
 * Helper to get Service Role Client (for actions requiring admin privileges or RLS bypass)
 */
function getSupabaseAdmin() {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    if (!serviceRoleKey) throw new Error('SERVICE_ROLE_KEY missing');
    return createAdminClient(supabaseUrl, serviceRoleKey);
}

/**
 * Check if current user is admin
 */
async function checkAdmin() {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { isAuthorized: false, user: null };

    const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single();

    // Cast profile to any to avoid strict type checking if profile type is incomplete
    const profileData = profile as any;

    return {
        isAuthorized: profileData?.role === 'admin',
        user
    };
}

export async function createExpense(data: Omit<Expense, 'id' | 'created_at' | 'updated_at' | 'user_id'>) {
    const { isAuthorized, user } = await checkAdmin();
    if (!isAuthorized || !user) {
        return { error: 'No autorizado' };
    }

    const adminSupabase = getSupabaseAdmin();
    const { error } = await adminSupabase
        .from('expenses')
        .insert({
            ...data,
            user_id: user.id
        });

    if (error) {
        console.error('Error creating expense:', error);
        return { error: 'Error al crear el gasto' };
    }

    revalidatePath('/admin/expenses');
    return { success: true };
}

export async function updateExpense(id: string, data: Partial<Omit<Expense, 'id' | 'created_at' | 'updated_at' | 'user_id'>>) {
    const { isAuthorized } = await checkAdmin();
    if (!isAuthorized) {
        return { error: 'No autorizado' };
    }

    const adminSupabase = getSupabaseAdmin();
    const { error } = await adminSupabase
        .from('expenses')
        .update(data)
        .eq('id', id);

    if (error) {
        console.error('Error updating expense:', error);
        return { error: 'Error al actualizar el gasto' };
    }

    revalidatePath('/admin/expenses');
    return { success: true };
}

export async function deleteExpense(id: string) {
    const { isAuthorized } = await checkAdmin();
    if (!isAuthorized) {
        return { error: 'No autorizado' };
    }

    const adminSupabase = getSupabaseAdmin();
    const { error } = await adminSupabase
        .from('expenses')
        .delete()
        .eq('id', id);

    if (error) {
        console.error('Error deleting expense:', error);
        return { error: 'Error al eliminar el gasto' };
    }

    revalidatePath('/admin/expenses');
    return { success: true };
}
