import { createBrowserClient } from '@supabase/ssr';
import { CONFIG } from '@/config/app.config';
import type { Database } from '@/types/database';

/**
 * Cliente de Supabase para uso en componentes del cliente
 */
export function createClient() {
    const supabaseUrl = CONFIG.SUPABASE.URL;
    const supabaseAnonKey = CONFIG.SUPABASE.ANON_KEY;

    if (!supabaseUrl || !supabaseAnonKey) {
        if (typeof window !== 'undefined') {
            console.error('❌ Supabase Client Error: NEXT_PUBLIC_SUPABASE_URL o NEXT_PUBLIC_SUPABASE_ANON_KEY no están configuradas en Vercel.');
        }
        // Return a placeholder client during build if variables are missing
        return createBrowserClient<Database>(
            'https://placeholder-project.supabase.co',
            'placeholder-key'
        );
    }

    return createBrowserClient<Database>(
        supabaseUrl,
        supabaseAnonKey
    );
}
