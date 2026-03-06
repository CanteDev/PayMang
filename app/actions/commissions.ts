'use server';

import { createClient } from '@/lib/supabase/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';
import { revalidatePath } from 'next/cache';

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
 * Validar una comisión (Solo para el agente asignado)
 */
export async function validateCommission(commissionId: string) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        return { error: 'No autorizado' };
    }

    // 1. Verificar propiedad y estado
    const { data: commission, error: fetchError } = await supabase
        .from('commissions')
        .select('agent_id, status')
        .eq('id', commissionId)
        .single();

    if (fetchError || !commission) {
        return { error: 'Comisión no encontrada' };
    }

    // Cast to any to avoid strict type checking on partial selection
    const commissionData = commission as any;

    if (commissionData.agent_id !== user.id) {
        return { error: 'No tienes permiso para validar esta comisión' };
    }

    if (commissionData.status !== 'pending' && commissionData.status !== 'incidence') {
        return { error: 'La comisión no está en estado pendiente o incidencia' };
    }

    // 2. Actualizar estado (Usando Admin Client para asegurar escritura si RLS es estricto)
    const adminSupabase = getSupabaseAdmin();
    const { error: updateError } = await adminSupabase
        .from('commissions')
        .update({
            status: 'validated',
            validated_at: new Date().toISOString()
        })
        .eq('id', commissionId);

    if (updateError) {
        return { error: 'Error al actualizar la comisión' };
    }

    revalidatePath('/closer/commissions');
    revalidatePath('/coach/commissions');
    revalidatePath('/setter/commissions');
    return { success: true };
}

/**
 * Reportar incidencia (Solo para el agente asignado)
 */
export async function reportIncidence(commissionId: string, note: string) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) return { error: 'No autorizado' };

    // 1. Verificar propiedad
    const { data: commission } = await supabase
        .from('commissions')
        .select('agent_id, status')
        .eq('id', commissionId)
        .single();

    const commissionData = commission as any;

    if (!commissionData || commissionData.agent_id !== user.id) {
        return { error: 'No tienes permiso' };
    }

    if (commissionData.status !== 'pending') {
        return { error: 'Solo se pueden reportar incidencias en comisiones pendientes' };
    }

    // 2. Actualizar
    const adminSupabase = getSupabaseAdmin();
    const { error } = await adminSupabase
        .from('commissions')
        .update({
            status: 'incidence',
            incidence_note: note
        })
        .eq('id', commissionId);

    if (error) return { error: 'Error al reportar incidencia' };

    revalidatePath('/closer/commissions');
    revalidatePath('/coach/commissions');
    revalidatePath('/setter/commissions');
    return { success: true };
}

/**
 * Marcar como Pagado (Solo Admin)
 */
export async function markAsPaid(commissionId: string) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) return { error: 'No autorizado' };

    // Verificar rol admin
    const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single();

    const profileData = profile as any;

    if (profileData?.role !== 'admin') {
        return { error: 'Requiere permisos de administrador' };
    }

    const adminSupabase = getSupabaseAdmin();
    const { error } = await adminSupabase
        .from('commissions')
        .update({
            status: 'paid',
            paid_at: new Date().toISOString()
        })
        .eq('id', commissionId);

    if (error) return { error: 'Error al marcar como pagado' };

    revalidatePath('/admin/payments');
    return { success: true };
}

/**
 * Resolver Incidencia (Solo Admin)
 * Devuelve la comisión a estado 'validated' (o 'pending' si se prefiere)
 */
export async function resolveIncidence(commissionId: string) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) return { error: 'No autorizado' };

    const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single();

    const profileData = profile as any;

    if (profileData?.role !== 'admin') {
        return { error: 'Requiere permisos de administrador' };
    }

    const adminSupabase = getSupabaseAdmin();
    const { error } = await adminSupabase
        .from('commissions')
        .update({
            status: 'validated', // Asumimos que al resolverla, queda lista para pago
            // incidence_note: null // Opcional: limpiar la nota o dejarla como histórico
            validated_at: new Date().toISOString()
        })
        .eq('id', commissionId);

    if (error) return { error: 'Error al resolver incidencia' };

    revalidatePath('/admin/payments');
    return { success: true };
}

/**
 * Modificar y Aceptar Incidencia (Solo Admin)
 * Permite al admin cambiar el agente y/o el importe antes de validar
 */
export async function modifyAndAcceptIncidence(
    commissionId: string,
    newAgentId: string,
    newAmount: number
) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) return { error: 'No autorizado' };

    const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single();

    const profileData = profile as any;

    if (profileData?.role !== 'admin') {
        return { error: 'Requiere permisos de administrador' };
    }

    const adminSupabase = getSupabaseAdmin();
    const { error } = await adminSupabase
        .from('commissions')
        .update({
            agent_id: newAgentId,
            amount: newAmount,
            status: 'validated',
            validated_at: new Date().toISOString()
        })
        .eq('id', commissionId);

    if (error) return { error: 'Error al modificar la comisión' };

    revalidatePath('/admin/payments');
    return { success: true };
}

/**
 * Rechazar Incidencia (Solo Admin)
 * Marca la comisión como 'cancelled'
 */
export async function rejectIncidence(commissionId: string) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) return { error: 'No autorizado' };

    const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single();

    const profileData = profile as any;

    if (profileData?.role !== 'admin') {
        return { error: 'Requiere permisos de administrador' };
    }

    const adminSupabase = getSupabaseAdmin();
    const { error } = await adminSupabase
        .from('commissions')
        .update({
            status: 'cancelled'
        })
        .eq('id', commissionId);

    if (error) return { error: 'Error al rechazar incidencia' };

    revalidatePath('/admin/payments');
    return { success: true };
}

/**
 * Reasignar Agente de una Comisión (Solo Admin)
 * Permite corregir el agente incorrecto en comisiones pending o validated.
 * También actualiza la venta (sales) para que futuros plazos vayan al nuevo agente.
 */
export async function reassignCommissionAgent(commissionId: string, newAgentId: string) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) return { error: 'No autorizado' };

    // Verificar rol admin
    const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single();

    if ((profile as any)?.role !== 'admin') {
        return { error: 'Requiere permisos de administrador' };
    }

    // Obtener la comisión con su sale_id y role_at_sale
    const { data: commission, error: fetchError } = await supabase
        .from('commissions')
        .select('id, sale_id, role_at_sale, status, agent_id')
        .eq('id', commissionId)
        .single();

    if (fetchError || !commission) {
        return { error: 'Comisión no encontrada' };
    }

    const c = commission as any;

    // Solo se puede reasignar en estado pending o validated
    if (!['pending', 'validated'].includes(c.status)) {
        return { error: `No se puede reasignar una comisión en estado "${c.status}". Solo se permiten estados pending o validated.` };
    }

    // El nuevo agente debe ser diferente al actual
    if (c.agent_id === newAgentId) {
        return { error: 'El nuevo agente debe ser diferente al actual' };
    }

    const adminSupabase = getSupabaseAdmin();

    // 1. Actualizar la comisión
    const { error: commissionError } = await adminSupabase
        .from('commissions')
        .update({ agent_id: newAgentId, updated_at: new Date().toISOString() })
        .eq('id', commissionId);

    if (commissionError) {
        return { error: 'Error al actualizar la comisión: ' + commissionError.message };
    }

    // 2. Mapear role_at_sale → campo de sales para actualizar futuros plazos
    const roleToSalesField: Record<string, string> = {
        closer: 'closer_id',
        coach: 'coach_id',
        setter: 'setter_id',
    };

    const saleField = roleToSalesField[c.role_at_sale];
    let saleUpdated = false;

    if (saleField && c.sale_id) {
        const { error: saleError } = await adminSupabase
            .from('sales')
            .update({ [saleField]: newAgentId, updated_at: new Date().toISOString() })
            .eq('id', c.sale_id);

        if (saleError) {
            // Non-blocking: commission was updated, warn about the sale
            console.error('Error actualizando sale:', saleError);
        } else {
            saleUpdated = true;
        }
    }

    revalidatePath('/admin/payments');
    revalidatePath('/admin/commissions');
    return { success: true, saleUpdated };
}

