import { processHotmartSync } from '../app/actions/sync';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

async function test() {
    try {
        console.log("Testing Hotmart Sync natively...");
        const response = await processHotmartSync();
        console.log("Success:", JSON.stringify(response, null, 2));
    } catch (e: any) {
        console.error("Error:", e.stack || e.message);
    }
}
test();
