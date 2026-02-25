import { hotmart } from '../lib/hotmart';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

async function test() {
    try {
        const response = await hotmart.request('/product/rest/v1/products', {
            method: 'GET'
        });
        console.log("Success:", response);
    } catch (e: any) {
        console.error("Error:", e.message);
    }
}

test();
