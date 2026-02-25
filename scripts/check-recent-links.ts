import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function check() {
    const { data, error } = await supabase
        .from('payment_links')
        .select('*')
        .order('updated_at', { ascending: false })
        .limit(5);

    if (error) console.error(error);
    console.log('Últimos 5 links modificados:');
    console.dir(data, { depth: null });
}

check();
