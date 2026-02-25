import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

// TEMPORARY migration route - DELETE after use
export async function GET(request: Request) {
    const authHeader = request.headers.get('authorization');
    if (authHeader !== 'Bearer migrate-packs-2026') {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    try {
        // Add columns one by one (IF NOT EXISTS not available via rpc easily)
        const queries = [
            `ALTER TABLE packs ADD COLUMN IF NOT EXISTS description TEXT`,
            `ALTER TABLE packs ADD COLUMN IF NOT EXISTS commission_closer DECIMAL(5,2) NOT NULL DEFAULT 0`,
            `ALTER TABLE packs ADD COLUMN IF NOT EXISTS commission_coach DECIMAL(5,2) NOT NULL DEFAULT 0`,
            `ALTER TABLE packs ADD COLUMN IF NOT EXISTS commission_setter DECIMAL(5,2) NOT NULL DEFAULT 0`,
        ];

        const results = [];
        for (const sql of queries) {
            const { error } = await supabase.rpc('exec_sql', { sql });
            results.push({ sql: sql.substring(0, 50), error: error?.message || null });
        }

        // Verify columns exist
        const { data, error: verifyError } = await supabase
            .from('packs')
            .select('id, description, commission_closer, commission_coach, commission_setter')
            .limit(1);

        return NextResponse.json({
            success: !verifyError,
            verifyError: verifyError?.message,
            results,
            data
        });
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
