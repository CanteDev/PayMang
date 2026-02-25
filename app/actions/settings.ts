'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';

export async function fetchSettings() {
    const supabase = await createClient();

    // Check admin role?
    // RLS policies should handle it, but good to be explicit or catching errors.

    const { data, error } = await supabase
        .from('app_settings')
        .select('*')
        .order('category', { ascending: true })
        .order('key', { ascending: true });

    if (error) {
        console.error('Error fetching settings:', error);
        throw new Error('No se pudieron cargar las configuraciones');
    }

    return data;
}

export async function getCompanyConfig() {
    const supabase = await createClient();
    // This needs to be readable without auth for the login page
    const { data } = await supabase
        .from('app_settings')
        .select('value')
        .eq('key', 'company_info')
        .single();

    return (data as any)?.value || { name: 'PayMang' };
}

export async function updateSetting(category: string, key: string, value: any) {
    const supabase = await createClient();

    // Validate if user is admin (RLS does this, but double check usually good)
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Usuario no autenticado');

    // Upsert (insert or update)
    const { error } = await (supabase
        .from('app_settings') as any)
        .upsert({
            category: category,
            key: key,
            value: value,
            updated_at: new Date().toISOString()
        }, { onConflict: 'key' });

    if (error) {
        console.error(`Error updating setting ${key}:`, error);
        throw new Error(`Error al actualizar la configuración ${key}`);
    }

    revalidatePath('/admin/settings');
    return { success: true };
}
