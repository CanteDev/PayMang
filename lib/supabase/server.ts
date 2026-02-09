import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { CONFIG } from '@/config/app.config';
import type { Database } from '@/types/database';

/**
 * Cliente de Supabase para uso en Server Components y Server Actions
 */
export async function createClient() {
    const cookieStore = await cookies();

    return createServerClient<Database>(
        CONFIG.SUPABASE.URL,
        CONFIG.SUPABASE.ANON_KEY,
        {
            cookies: {
                getAll() {
                    return cookieStore.getAll();
                },
                setAll(cookiesToSet) {
                    try {
                        cookiesToSet.forEach(({ name, value, options }) =>
                            cookieStore.set(name, value, options)
                        );
                    } catch {
                        // Ignorar errores en middleware
                    }
                },
            },
        }
    );
}
