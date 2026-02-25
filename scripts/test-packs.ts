import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
    const { data: packs, error } = await supabase.from('packs').select('id, name');
    console.log("=== ALL PACKS IN DB ===");
    console.log(packs);
}
main();
