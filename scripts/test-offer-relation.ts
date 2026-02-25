import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();
dotenv.config({ path: '.env.local' });

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function main() {
    console.log("Testing Offer Relation...");

    // 1. Get any Pack
    const { data: pack } = await supabase.from('packs').select('id, name').limit(1).single();
    if (!pack) { console.log("No packs found!"); return; }

    console.log(`Using pack: ${pack.name} (${pack.id})`);

    // 2. Insert dummy offer
    const { data: offer, error: offerError } = await supabase.from('pack_offers').insert({
        pack_id: pack.id,
        gateway: 'hotmart',
        name: 'Test Offer',
        price: 99.99,
        currency: 'EUR',
        checkout_url: 'https://pay.hotmart.com/test1234'
    }).select().single();

    if (offerError) throw offerError;
    console.log(`Created Offer: ${offer.id}`);

    // 3. Insert dummy payment link
    const linkId = 'test_short_code';
    const { data: student } = await supabase.from('students').select('id').limit(1).single();
    const { data: profile } = await supabase.from('profiles').select('id').limit(1).single();

    if (!student || !profile) {
        console.log("No student or profile found!"); return;
    }

    const { error: linkError } = await (supabase.from('payment_links') as any).upsert({
        id: linkId,
        pack_id: pack.id,
        pack_offer_id: offer.id,
        student_id: student.id,
        created_by: profile.id,
        gateway: 'hotmart',
        status: 'pending',
    }).select().single();

    if (linkError) throw linkError;
    console.log(`Created Link: ${linkId}`);

    // 4. Test the exact query used in Route Handler
    const { data: fetchedLink, error: fetchError } = await supabase
        .from('payment_links')
        .select(`
            *,
            pack:packs(*),
            offer:pack_offers(*)
        `)
        .eq('id', linkId)
        .single();

    if (fetchError) {
        console.error("Fetch Error:", fetchError);
    } else {
        console.log("Fetched Link successful!");
        console.log(`Link Offer URL: ${(fetchedLink as any).offer?.checkout_url}`);
    }

    // Cleanup
    await supabase.from('payment_links').delete().eq('id', linkId);
    await supabase.from('pack_offers').delete().eq('id', offer.id);
    console.log("Cleanup done.");
}

main().catch(console.error);
