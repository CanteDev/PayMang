import { hotmart } from '../lib/hotmart';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

async function test() {
    try {
        console.log("Fetching Hotmart Products directly...");
        const response: any = await hotmart.request('https://developers.hotmart.com/products/api/v1/products', {
            method: 'GET'
        });

        const items = response?.items || response?.data || [];
        console.log(`Found ${items.length} products`);

        if (items.length > 0) {
            console.log("\nSample product structure:");
            console.log(JSON.stringify(items[0], null, 2));

            console.log("\nAll Products and their statuses:");
            items.forEach((p: any) => {
                console.log(`- ${p.name}: Status = ${p.status}`);
            });
        }
    } catch (e: any) {
        console.error("Error:", e.stack || e.message);
    }
}
test();
