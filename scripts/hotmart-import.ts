import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import { hotmart } from '../lib/hotmart';
import { Database } from '../types/database';

// Initialize Supabase admin client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
    console.error('Missing Supabase credentials in .env');
    process.exit(1);
}

const supabase = createClient<any>(supabaseUrl, supabaseServiceKey);

interface HotmartProduct {
    id: number;
    ucode: string;
    name: string;
    description: string;
    format: string;
    status: string;
}

interface HotmartOffer {
    offerCode: string;
    name: string;
    description?: string;
    price: {
        value: number;
        currencyCode: string;
    };
    paymentMode: string;
    status: string;
}

async function main() {
    console.log('🔄 Init Hotmart Products Import...');

    try {
        // 1. Obtener todos los productos de Hotmart
        console.log('📦 Fetching products from Hotmart...');
        const productsResponse = await hotmart.request<any>('product/rest/v1/products?max_results=50');
        const products: HotmartProduct[] = productsResponse.items || [];

        console.log(`✅ Found ${products.length} products on Hotmart.`);

        for (const product of products) {
            console.log(`\n---------------------------------`);
            console.log(`Processing Product: ${product.name} (${product.id})`);

            if (product.status !== 'ACTIVE') {
                console.log(`Skipping inactive product (Status: ${product.status})`);
                continue;
            }

            // 2. Upsert Pack
            const { data: pack, error: packError } = await supabase
                .from('packs')
                .select('*')
                .eq('external_product_id', product.id.toString())
                .maybeSingle();

            if (packError) throw packError;

            let packId: string;

            if (pack) {
                console.log(`Pack exists in DB (ID: ${pack.id}). Updating...`);
                // Update basic data, taking care not to overwrite price directly if we fetch offers
                const { error: updateError } = await supabase
                    .from('packs')
                    .update({
                        name: product.name,
                        description: product.description || pack.description,
                        is_active: true
                    })
                    .eq('id', pack.id);

                if (updateError) throw updateError;
                packId = pack.id;
            } else {
                console.log(`Pack not found in DB. Creating new pack...`);
                const { data: newPack, error: insertError } = await supabase
                    .from('packs')
                    .insert({
                        name: product.name,
                        description: product.description,
                        price: 0, // Base price will be determined by offers or updated later
                        gateway_ids: {},
                        external_product_id: product.id.toString(),
                        commission_closer: 8, // Set some defaults
                        commission_coach: 10,
                        commission_setter: 1
                    })
                    .select()
                    .single();

                if (insertError) throw insertError;
                packId = newPack.id;
            }

            // 3. Obtener Offers para el producto
            console.log(`🔍 Fetching offers for product ${product.id} (ucode: ${product.ucode})...`);
            try {
                // Testing the standard developer endpoint
                const offersResponse = await hotmart.request<any>(`product/rest/v1/Offers?ucode=${product.ucode}`);
                const offers: HotmartOffer[] = offersResponse.items || [];

                console.log(`✅ Found ${offers.length} offers for this product.`);

                for (const offer of offers) {
                    // Solo importamos ofertas en ciertos estados (por ejemplo si tienen un estado ACTIVE, aunque Hotmart a veces no lo devuelve muy explícito)
                    // The checkout URL follows a pattern using the product ucode and offer code
                    const checkoutUrl = `https://pay.hotmart.com/${product.ucode}?checkoutMode=10&off=${offer.offerCode}`;

                    console.log(`   - Offer: ${offer.name} | Price: ${offer.price.value} ${offer.price.currencyCode}`);

                    // Upsert Offer in pack_offers
                    const { data: existingOffer, error: offerFetchError } = await supabase
                        .from('pack_offers')
                        .select('id')
                        .eq('pack_id', packId)
                        .eq('gateway', 'hotmart')
                        .eq('external_id', offer.offerCode)
                        .maybeSingle();

                    if (offerFetchError) throw offerFetchError;

                    if (existingOffer) {
                        await supabase
                            .from('pack_offers')
                            .update({
                                name: offer.name,
                                price: offer.price.value,
                                currency: offer.price.currencyCode,
                                checkout_url: checkoutUrl,
                                is_active: true
                            })
                            .eq('id', existingOffer.id);
                    } else {
                        await supabase
                            .from('pack_offers')
                            .insert({
                                pack_id: packId,
                                gateway: 'hotmart',
                                external_id: offer.offerCode,
                                name: offer.name,
                                price: offer.price.value,
                                currency: offer.price.currencyCode,
                                checkout_url: checkoutUrl,
                                is_active: true
                            });
                    }
                }
            } catch (err: any) {
                console.error(`⚠️ Failed to fetch offers for product ${product.id}. Error: ${err.message}`);
                // Continue with next product
            }
        }

        console.log('\n🎉 Import complete!');

    } catch (error) {
        console.error('❌ Import failed:', error);
    }
}

main();
