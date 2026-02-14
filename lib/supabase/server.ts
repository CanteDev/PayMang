import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { CONFIG } from '@/config/app.config';
import type { Database } from '@/types/database';

/**
 * Cliente de Supabase para uso en Server Components y Server Actions
 */
export async function createClient() {
    const supabaseUrl = CONFIG.SUPABASE.URL;
    const supabaseAnonKey = CONFIG.SUPABASE.ANON_KEY;

    // Use empty/mock values if missing during build
    const url = supabaseUrl || 'https://placeholder-project.supabase.co';
    const key = supabaseAnonKey || 'placeholder-key';

    const cookieStore = await cookies();

    return createServerClient<Database>(
        url,
        key,
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
