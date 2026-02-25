import { HotmartClient } from '../lib/hotmart';
import * as dotenv from 'dotenv';
dotenv.config();
dotenv.config({ path: '.env.local' });

async function main() {
    const hotmart = HotmartClient.getInstance();

    try {
        const prod = await hotmart.request<any>('https://developers.hotmart.com/products/api/v1/products?max_results=1');
        console.log('Product:', prod.items[0]);

        try {
            const offs = await hotmart.request<any>(`https://developers.hotmart.com/products/api/v1/products/${prod.items[0].ucode}/offers?max_results=1`);
            console.log('Offer:', offs.items[0]);
        } catch (e: any) {
            console.log("Offer error:", e.message);
        }
    } catch (e: any) {
        console.log("Error:", e.message);
    }
}
main();
