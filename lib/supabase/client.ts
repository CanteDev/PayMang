import { createBrowserClient } from '@supabase/ssr';
import { CONFIG } from '@/config/app.config';
import type { Database } from '@/types/database';

/**
 * Cliente de Supabase para uso en componentes del cliente
 */
export function createClient() {
    return createBrowserClient<Database>(
        CONFIG.SUPABASE.URL,
        CONFIG.SUPABASE.ANON_KEY
    );
}
