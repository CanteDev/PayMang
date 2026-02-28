import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
    const { searchParams, origin } = new URL(request.url);
    const code = searchParams.get('code');
    const next = searchParams.get('next') ?? '/';

    if (code) {
        try {
            const supabase = await createClient();
            const { error } = await supabase.auth.exchangeCodeForSession(code);

            if (error) {
                console.error('Exchange error:', error);
                return NextResponse.redirect(`${origin}/error?message=auth_code_error&details=${encodeURIComponent(error.message)}`);
            }

            const forwardedHost = request.headers.get('x-forwarded-host');
            const isLocal = origin.includes('localhost');

            let baseUrl = origin;
            if (!isLocal && forwardedHost) {
                baseUrl = `https://${forwardedHost}`;
            }

            // Fallback: if next is '/', we probably want /update-password for invites/recovery
            const finalNext = (next === '/' || next === '') ? '/update-password' : next;

            console.log('Auth Callback Success. Redirecting to:', `${baseUrl}${finalNext}`);

            return NextResponse.redirect(new URL(finalNext, baseUrl));
        } catch (err: any) {
            console.error('Unexpected callback error:', err);
            return NextResponse.redirect(`${origin}/error?message=unexpected_error`);
        }
    }

    return NextResponse.redirect(`${origin}/error?message=no_code_provided`);
}
