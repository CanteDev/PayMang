import { createClient } from '@/lib/supabase/client'; // Client-side or Server?
// We need a server-side helper primarily.
// Let's create `lib/config/server-config.ts` for server actions.

import { createClient as createServerClient } from '@/lib/supabase/server';
import { CONFIG } from '@/config/app.config';

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
        const supabase = await createServerClient();

        // We need to use service role if policies block reading?
        // But `createServerClient` uses cookies (authenticated user).
        // If Admin is logged in, they can read. 
        // If Public user (checkout), they CANNOT read `app_settings` (RLS).
        // So for public-facing things (e.g. Stripe Key for checkout), we might need an Action that uses Service Role?
        // OR we use Service Role for fetching config in `server-config.ts`.
        // Let's assume we maintain strict security:
        // Config used in backend flows (Cron, Webhooks, API Routes) -> Use Service Role.
        // Config used in UI (Admin) -> Use User Role.

        // For this helper, let's try to use the auth client first. If fails (or returns null), fallback?
        // Actually, for consistency, server-side config fetching should probably be privileged if it's for system logic.

        // Let's stick to standard client for now.
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
