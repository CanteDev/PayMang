import { createClient } from '@supabase/supabase-js';
import { CONFIG } from '@/config/app.config';

/**
 * Gets the gateway config from app_settings using the service role key.
 * This ensures it works in public routes (like /p/[shortCode]) where there's no user session.
 */
export async function getGatewayConfig(gateway: 'stripe' | 'hotmart' | 'sequra'): Promise<any> {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

    // Config keys in DB
    const keyMap = {
        stripe: 'stripe_config',
        hotmart: 'hotmart_config',
        sequra: 'sequra_config'
    };

    const dbKey = keyMap[gateway];

    // Use service role key to bypass RLS - works from any context (public or authenticated)
    if (serviceRoleKey) {
        const supabase = createClient(supabaseUrl, serviceRoleKey);
        const { data, error } = await supabase
            .from('app_settings')
            .select('value')
            .eq('key', dbKey)
            .single<any>();

        if (!error && data) {
            const dbConfig = data.value;
            const envConfig = getEnvFallback(gateway);
            return { ...envConfig, ...dbConfig };
        }
    }

    // Fallback to env vars if service role key is not set or DB query fails
    console.log(`Using environment config for ${gateway} (DB config not found or service role key missing)`);
    return getEnvFallback(gateway);
}

function getEnvFallback(gateway: 'stripe' | 'hotmart' | 'sequra') {
    switch (gateway) {
        case 'stripe':
            return {
                publishable_key: CONFIG.GATEWAYS.STRIPE.PUBLISHABLE_KEY,
                secret_key: CONFIG.GATEWAYS.STRIPE.API_KEY,
                webhook_secret: CONFIG.GATEWAYS.STRIPE.WEBHOOK_SECRET,
            };
        case 'hotmart':
            return {
                client_id: CONFIG.GATEWAYS.HOTMART.CLIENT_ID,
                client_secret: CONFIG.GATEWAYS.HOTMART.CLIENT_SECRET,
                basic_auth: CONFIG.GATEWAYS.HOTMART.BASIC_AUTH,
                webhook_secret: CONFIG.GATEWAYS.HOTMART.WEBHOOK_SECRET,
                api_url: CONFIG.GATEWAYS.HOTMART.API_URL,
                auth_url: CONFIG.GATEWAYS.HOTMART.AUTH_URL,
            };
        case 'sequra':
            return {
                merchant_id: CONFIG.GATEWAYS.SEQURA.MERCHANT_ID,
                api_key: CONFIG.GATEWAYS.SEQURA.API_KEY,
                api_url: CONFIG.GATEWAYS.SEQURA.API_URL,
                environment: 'sandbox',
            };
    }
}
