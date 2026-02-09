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

    // Si hay usuario y está en login, redirigir al dashboard
    if (user && request.nextUrl.pathname === '/login') {
        const url = request.nextUrl.clone();
        url.pathname = '/admin'; // Cambiar según el rol más adelante
        return NextResponse.redirect(url);
    }

    return supabaseResponse;
}
