/**
 * Configuración central de la aplicación PayMang
 * Este archivo contiene todas las constantes configurables por cliente
 */

export const CONFIG = {
    // Porcentajes de comisión (configurables por cliente)
    COMMISSION_RATES: {
        COACH: 0.10,    // 10%
        CLOSER: 0.08,   // 8%
        SETTER: 0.01,   // 1%
    },

    // Split de seQura (70/15/15)
    SEQURA_MILESTONES: {
        MILESTONE_1: 0.70,  // 70% - Pago inicial
        MILESTONE_2: 0.15,  // 15% - Segundo pago
        MILESTONE_3: 0.15,  // 15% - Pago final
    },

    // Comportamiento de reembolsos
    REFUNDS: {
        // Si es true, genera comisiones negativas al hacer refund
        GENERATE_NEGATIVE_COMMISSIONS: false,
    },

    // Worker de seQura
    SEQURA_WORKER: {
        CRON_SCHEDULE: '0 6 * * *', // 06:00 AM diariamente
    },

    // URLs de pasarelas (configurables por entorno)
    GATEWAYS: {
        STRIPE: {
            PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || '',
            API_KEY: process.env.STRIPE_SECRET_KEY || '',
            WEBHOOK_SECRET: process.env.STRIPE_WEBHOOK_SECRET || '',
        },
        HOTMART: {
            API_KEY: process.env.HOTMART_API_KEY || '',
            CLIENT_ID: process.env.HOTMART_CLIENT_ID || '',
            CLIENT_SECRET: process.env.HOTMART_CLIENT_SECRET || '',
            BASIC_AUTH: process.env.HOTMART_BASIC || '',
            WEBHOOK_SECRET: process.env.HOTMART_WEBHOOK_SECRET || '',
            API_URL: process.env.HOTMART_API_URL || 'https://developers.hotmart.com/payments/api/v1', // Default to production, override for sandbox
            AUTH_URL: process.env.HOTMART_AUTH_URL || 'https://api-sec-vlc.hotmart.com/security/oauth/token',
        },
        SEQURA: {
            MERCHANT_ID: process.env.SEQURA_MERCHANT_ID || '',
            API_KEY: process.env.SEQURA_API_KEY || '',
            API_URL: process.env.SEQURA_API_URL || 'https://api.sequra.com',
        },
    },

    // Supabase
    SUPABASE: {
        URL: process.env.NEXT_PUBLIC_SUPABASE_URL || '',
        ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
    },

    // App
    APP: {
        NAME: 'PayMang',
        URL: process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
    },
} as const;

// Tipos derivados
export type UserRole = 'admin' | 'closer' | 'coach' | 'setter';
export type StudentStatus = 'active' | 'finished' | 'defaulted' | 'inactive';
export type GatewayType = 'stripe' | 'hotmart' | 'sequra';
export type SaleStatus = 'pending' | 'paid' | 'refunded';
export type CommissionStatus = 'pending' | 'incidence' | 'validated' | 'paid' | 'cancelled';
export type LinkStatus = 'pending' | 'clicked' | 'paid' | 'deleted';
