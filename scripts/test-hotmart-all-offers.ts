import 'dotenv/config';
import { hotmart } from '../lib/hotmart';

async function main() {
    console.log('Fetching all Hotmart products and their offers...\n');

    try {
        const productsResponse: any = await hotmart.request('https://developers.hotmart.com/products/api/v1/products?max_results=50');
        const items = productsResponse?.items || [];
        const activeItems = items.filter((p: any) => p.status === 'ACTIVE');

        const dump: any[] = [];

        for (const prod of activeItems) {
            let offers = [];
            if (prod.ucode) {
                try {
                    const offersRes: any = await hotmart.request(`https://developers.hotmart.com/products/api/v1/products/${prod.ucode}/offers?max_results=50`);
                    offers = offersRes?.items || [];
                } catch (e: any) { }
            }

            dump.push({
                product: {
                    id: prod.id,
                    name: prod.name,
                    ucode: prod.ucode,
                    status: prod.status
                },
                offers: offers
            });
        }

        console.log(JSON.stringify(dump, null, 2));
    } catch (e: any) {
        console.error('Error:', e.message);
    }
}

main();
