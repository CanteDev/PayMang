import { HotmartClient } from '../lib/hotmart';
import * as dotenv from 'dotenv';
dotenv.config();
dotenv.config({ path: '.env.local' });

async function main() {
    console.log("Investigating Hotmart Affiliate API...");
    const hotmart = new HotmartClient();

    // Attempt to hit the affiliate hotlinks endpoint.
    // Sometimes it's on the base URL, sometimes on developers.hotmart.com

    const endpointsToTry = [
        '/affiliate/rest/v2/hotlinks',
        'https://developers.hotmart.com/payments/api/v1/affiliate/rest/v2/hotlinks',
        'https://api-sec-vlc.hotmart.com/affiliate/rest/v2/hotlinks'
    ];

    for (const endpoint of endpointsToTry) {
        console.log(`\n\n--- Testing Endpoint: ${endpoint} ---`);
        try {
            const data = await hotmart.request<any>(endpoint);
            console.log("✅ Success! Data returned:");
            console.log(JSON.stringify(data, null, 2));
        } catch (error: any) {
            console.error(`❌ Failed: ${error.message}`);
            if (error.response?.data) {
                console.error("Response data:", error.response.data);
            }
        }
    }
}

main().catch(console.error);
