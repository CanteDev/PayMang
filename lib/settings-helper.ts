import { createClient } from '@/lib/supabase/server';
import { CONFIG } from '@/config/app.config';

type GatewayConfig<T> = T;

export async function getGatewayConfig(gateway: 'stripe' | 'hotmart' | 'sequra'): Promise<any> {
    const supabase = await createClient();

    // Config keys in DB
    const keyMap = {
        stripe: 'stripe_config',
        hotmart: 'hotmart_config',
        sequra: 'sequra_config'
    };

    const dbKey = keyMap[gateway];

    // Try to fetch from DB
    const { data, error } = await supabase
        .from('app_settings')
        .select('value')
        .eq('key', dbKey)
        .single<any>(); // Force any to avoid 'never' issue with JSONB typings

    if (error || !data) {
        // Fallback to Env Vars / CONFIG
        console.log(`Using environment config for ${gateway} (DB config not found or error)`);
        return getEnvFallback(gateway);
    }

    // Merge with defaults/env if partial config? 
    // For now, if DB has it, use it. But maybe merge is safer.
    const dbConfig = data.value;
    const envConfig = getEnvFallback(gateway);

    return { ...envConfig, ...dbConfig };
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
                environment: 'sandbox', // Default fallback
            };
    }
}
