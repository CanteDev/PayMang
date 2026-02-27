'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';

/**
 * Reassigns an offer to a different pack.
 */
export async function reassignOfferPackAction(offerId: string, newPackId: string) {
    const supabase = await createClient();

    // Verify Admin
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { success: false, error: 'Usuario no autenticado' };

    const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single() as { data: { role: string } | null };

    if (profile?.role !== 'admin') {
        return { success: false, error: 'No tienes permisos para realizar esta acción' };
    }

    try {
        const { error } = await (supabase
            .from('pack_offers') as any)
            .update({ pack_id: newPackId })
            .eq('id', offerId);

        if (error) throw error;

        revalidatePath('/admin/packs');
        return { success: true };
    } catch (err: any) {
        console.error('Error reassigning offer:', err);
        return { success: false, error: err.message || 'Error al reasignar la oferta' };
    }
}
