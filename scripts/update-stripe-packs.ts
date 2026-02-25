import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
    // 1. Find existing packs
    const { data: packs, error } = await supabase.from('packs').select('*');

    if (error) {
        console.error('Error fetching packs', error);
        return;
    }

    const platOneTime = packs.find(p => p.name.includes('EcomBomb Program || Platinum') && !p.name.includes('plazos'));
    const platInstallments = packs.find(p => p.name.includes('EcomBomb Program || Platinum (3 plazos)'));

    console.log("Found OneTime Pack:", platOneTime?.name, platOneTime?.id);
    console.log("Found Installments Pack:", platInstallments?.name, platInstallments?.id);

    // 2. Insert Offer for One Time
    if (platOneTime) {
        // Delete existing buggy ones if they somehow exist
        await supabase.from('pack_offers').delete().eq('pack_id', platOneTime.id).eq('gateway', 'stripe');

        const { error: offerError1 } = await supabase
            .from('pack_offers')
            .insert({
                pack_id: platOneTime.id,
                gateway: 'stripe',
                name: 'Stripe Pago Único',
                price: 5999,
                currency: 'EUR',
                external_id: 'prod_U2qM0eb1qAqfL5', // The Stripe Product ID
                checkout_url: 'https://buy.stripe.com/test_...',
                is_active: true
            });

        if (offerError1) console.error("Error inserting OneTime offer:", offerError1);
        else console.log("✅ Inserted OneTime offer for Stripe");
    }

    // 3. Insert Offer for Installments
    if (platInstallments) {
        await supabase.from('pack_offers').delete().eq('pack_id', platInstallments.id).eq('gateway', 'stripe');

        const { error: offerError2 } = await supabase
            .from('pack_offers')
            .insert({
                pack_id: platInstallments.id,
                gateway: 'stripe',
                name: 'Stripe Pago Recurrente (3 Cuotas)',
                price: 1999, // monthly price
                currency: 'EUR',
                external_id: 'prod_U2qLKyExuqgH84',
                checkout_url: 'https://buy.stripe.com/test_...',
                is_active: true
            });

        if (offerError2) console.error("Error inserting Installments offer:", offerError2);
        else console.log("✅ Inserted Installments offer for Stripe");
    }
}
main();
