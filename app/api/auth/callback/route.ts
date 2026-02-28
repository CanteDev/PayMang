import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: Request) {
    const { searchParams, origin } = new URL(request.url);
    const code = searchParams.get('code');
    // if "next" is in param, use it as the redirect URL
    const next = searchParams.get('next') ?? '/';

    if (code) {
        const supabase = await createClient();
        const { error } = await supabase.auth.exchangeCodeForSession(code);

        if (error) {
            console.error('❌ Error en exchangeCodeForSession:', error.message, error.status, {
                code: code.substring(0, 10) + '...',
                origin,
                next
            });
            return NextResponse.redirect(`${origin}/error?message=auth_code_error&detail=${encodeURIComponent(error.message)}`);
        }

        const forwardedHost = request.headers.get('x-forwarded-host'); // original origin before load balancer
        const isLocal = origin.includes('localhost');

        if (isLocal) {
            return NextResponse.redirect(`${origin}${next}`);
        } else if (forwardedHost) {
            // Aseguramos que usamos siempre https en producción si hay forwardedHost
            return NextResponse.redirect(`https://${forwardedHost}${next}`);
        } else {
            return NextResponse.redirect(`${origin}${next}`);
        }
    }

    console.error('❌ Callback llamado sin código de autorización');
    return NextResponse.redirect(`${origin}/error?message=auth_code_error`);
}
