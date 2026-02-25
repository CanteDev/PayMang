import { createClient } from '@supabase/supabase-js';
import Stripe from 'stripe';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing Supabase environment variables');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
    const { data: configData, error } = await supabase
        .from('app_settings')
        .select('value')
        .eq('key', 'stripe_config')
        .single();

    if (error || !configData) {
        console.error('Error fetching Stripe config from DB:', error);
        return;
    }

    const stripeConfig = configData.value as any;
    const secretKey = stripeConfig.SECRET_KEY || stripeConfig.secret_key;

    if (!secretKey) {
        console.error('No Stripe Secret Key found in DB.');
        console.log('Current stripe config in DB:', stripeConfig);
        return;
    }

    const stripe = new Stripe(secretKey, { apiVersion: '2023-10-16' as any });

    console.log(`Connecting to Stripe with secret key starting with: ${secretKey.substring(0, 8)}...`);

    // Fetch active products
    const productsResponse = await stripe.products.list({
        active: true,
        limit: 10
    });

    const pricesResponse = await stripe.prices.list({
        active: true,
        limit: 20
    });

    // Map prices to products for a clean output
    const products = productsResponse.data.map(p => {
        const productPrices = pricesResponse.data.filter((pri: any) => pri.product === p.id);
        return {
            id: p.id,
            name: p.name,
            description: p.description,
            prices: productPrices.map((pri: any) => ({
                id: pri.id,
                currency: pri.currency,
                unit_amount_decimal: pri.unit_amount_decimal ? (parseFloat(pri.unit_amount_decimal) / 100).toFixed(2) : '0.00',
                type: pri.type, // 'one_time' or 'recurring'
                recurring: pri.recurring // Contains interval details if recurring
            }))
        };
    });

    console.log("=== STRIPE PRODUCTS & PRICES ===");
    console.log(JSON.stringify(products, null, 2));
}

main().catch(console.error);
