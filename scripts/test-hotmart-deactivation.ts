import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
    console.log("Checking DB state for 'CONTINUO' and 'ECOMBOMB - BRONZE'...");

    // Find the packs
    const { data: packs } = await supabase.from('packs').select('*').in('name', ['CONTINUO', 'ECOMBOMB - BRONZE']);
    console.log("Packs:");
    console.log(JSON.stringify(packs, null, 2));

    if (packs) {
        for (const p of packs) {
            console.log(`\nOffers for Pack ${p.name}:`);
            const { data: offers } = await supabase.from('pack_offers').select('*').eq('pack_id', p.id);
            console.log(JSON.stringify(offers, null, 2));
        }
    }
}
main();
