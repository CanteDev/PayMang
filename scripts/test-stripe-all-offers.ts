import 'dotenv/config';
import { getGatewayConfig } from '../lib/settings-helper';
import Stripe from 'stripe';

async function main() {
    console.log('Fetching all Stripe products and their prices...\n');

    try {
        const secretKey = process.env.STRIPE_SECRET_KEY;
        if (!secretKey) {
            console.error('No STRIPE_SECRET_KEY in env.');
            process.exit(1);
        }

        const stripe = new Stripe(secretKey, { apiVersion: '2023-10-16' as any });

        const productsResponse = await stripe.products.list({ active: true, limit: 10 });
        const pricesResponse = await stripe.prices.list({ active: true, limit: 100 });

        const result: any[] = [];

        for (const prod of productsResponse.data) {
            const prodPrices = pricesResponse.data.filter((pri: any) => pri.product === prod.id);
            result.push({
                product: {
                    id: prod.id,
                    name: prod.name,
                    description: prod.description
                },
                prices: prodPrices.map(p => ({
                    id: p.id,
                    type: p.type,
                    unit_amount: p.unit_amount,
                    currency: p.currency,
                    recurring: p.recurring
                }))
            });
        }

        console.log(JSON.stringify(result, null, 2));
    } catch (e: any) {
        console.error('Error fetching Stripe data:', e.message);
    }
}

main();
