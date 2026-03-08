import { createClient as createAdminClient } from '@supabase/supabase-js';
import { CONFIG } from '@/config/app.config';

function getSupabaseAdmin() {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    if (!serviceRoleKey) throw new Error('SERVICE_ROLE_KEY missing');
    return createAdminClient(supabaseUrl, serviceRoleKey);
}

// Simple in-memory cache for serverless instance lifetime
// Note: In serverless (Vercel), this cache is per-lambda instance and short-lived.
const settingsCache: Record<string, { value: any, expires: number }> = {};
const CACHE_TTL = 60 * 1000; // 1 minute

export async function getAppConfig(key: string, defaultValue?: any): Promise<any> {
    const now = Date.now();

    // Check cache
    if (settingsCache[key] && settingsCache[key].expires > now) {
        return settingsCache[key].value;
    }

    try {
        // USAR SIEMPRE ADMIN CLIENT PARA LEER CONFIGURACIÓN (Bypass RLS)
        // La configuración del sistema (como API keys) se necesita incluso
        // en rutas públicas (ej. checkout público) donde no hay sesión de usuario.
        // Al ser código server-side, es seguro usar el service_role_key.
        let supabase;
        try {
            supabase = getSupabaseAdmin();
        } catch (err: any) {
            console.error('Error init admin client for config:', err);
            // Si falta la env var, fallará
            return defaultValue !== undefined ? defaultValue : getStaticFallback(key);
        }

        const { data, error } = await supabase
            .from('app_settings')
            .select('value')
            .eq('key', key)
            .single();

        if (data) {
            const safeData = data as any;
            settingsCache[key] = { value: safeData.value, expires: now + CACHE_TTL };
            return safeData.value;
        }

    } catch (e) {
        console.error(`Error fetching config for ${key}:`, e);
    }

    // Fallback to static config or provided default
    return defaultValue !== undefined ? defaultValue : getStaticFallback(key);
}

function getStaticFallback(key: string): any {
    switch (key) {
        case 'commission_rates': return CONFIG.COMMISSION_RATES;
        case 'sequra_milestones': return CONFIG.SEQURA_MILESTONES;
        case 'stripe_config': return CONFIG.GATEWAYS.STRIPE;
        case 'hotmart_config': return CONFIG.GATEWAYS.HOTMART;
        case 'sequra_config': return CONFIG.GATEWAYS.SEQURA;
        case 'company_info': return { name: CONFIG.APP.NAME, currency: 'EUR' }; // Default
        default: return null;
    }
}
