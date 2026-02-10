import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { CONFIG } from '@/config/app.config';

/**
 * Middleware de Supabase para manejar autenticación y RLS
 */
export async function updateSession(request: NextRequest) {
    let supabaseResponse = NextResponse.next({
        request,
    });

    const supabase = createServerClient(
        CONFIG.SUPABASE.URL,
        CONFIG.SUPABASE.ANON_KEY,
        {
            cookies: {
                getAll() {
                    return request.cookies.getAll();
                },
                setAll(cookiesToSet) {
                    cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
                    supabaseResponse = NextResponse.next({
                        request,
                    });
                    cookiesToSet.forEach(({ name, value, options }) =>
                        supabaseResponse.cookies.set(name, value, options)
                    );
                },
            },
        }
    );

    // IMPORTANTE: Evitar múltiples llamadas a supabase.auth.getUser()
    const {
        data: { user },
    } = await supabase.auth.getUser();

    // Rutas públicas que no requieren autenticación
    const publicRoutes = ['/login'];
    const isPublicRoute = publicRoutes.some(route => request.nextUrl.pathname.startsWith(route));

    // Si no hay usuario y la ruta no es pública, redirigir a login
    if (!user && !isPublicRoute) {
        const url = request.nextUrl.clone();
        url.pathname = '/login';
        return NextResponse.redirect(url);
    }

    // Si hay usuario y está en login, redirigir al dashboard según rol
    if (user && request.nextUrl.pathname === '/login') {
        // Obtener el perfil del usuario para conocer su rol
        const { data: profile } = await supabase
            .from('profiles')
            .select('role')
            .eq('id', user.id)
            .single();

        const url = request.nextUrl.clone();

        // Redirigir según el rol
        switch (profile?.role) {
            case 'admin':
                url.pathname = '/admin';
                break;
            case 'coach':
                url.pathname = '/coach';
                break;
            case 'closer':
                url.pathname = '/closer';
                break;
            case 'setter':
                url.pathname = '/setter';
                break;
            default:
                url.pathname = '/login';
        }

        return NextResponse.redirect(url);
    }

    return supabaseResponse;
}
