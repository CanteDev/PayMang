import { HotmartClient } from '../lib/hotmart';
import * as dotenv from 'dotenv';
dotenv.config();
dotenv.config({ path: '.env.local' });

async function main() {
    console.log("Investigating Hotmart Offers API v2...");
    const hotmart = new HotmartClient();

    // First, let's get a product ID to test with
    console.log("\n--- Fetching a product to test ---");
    let productId = '';
    try {
        const productsResponse = await hotmart.request<any>('https://developers.hotmart.com/products/api/v1/products?max_results=1');
        if (productsResponse && productsResponse.items && productsResponse.items.length > 0) {
            productId = productsResponse.items[0].ucode;
            console.log(`Found product ID: ${productId}`);
        } else {
            console.log("No products found to test with.");
            return;
        }
    } catch (error: any) {
        console.error(`Failed to fetch product: ${error.message}`);
        return;
    }

    // Now test the v2 offers endpoint
    const endpointsToTry = [
        `/product/rest/v2/products/${productId}/offers`,
        `https://developers.hotmart.com/products/rest/v2/products/${productId}/offers`,
        `https://developers.hotmart.com/products/api/v2/products/${productId}/offers`,
        `https://api-sec-vlc.hotmart.com/product/rest/v2/products/${productId}/offers`
    ];

    for (const endpoint of endpointsToTry) {
        console.log(`\n\n--- Testing Endpoint: ${endpoint} ---`);
        try {
            const data = await hotmart.request<any>(endpoint);
            console.log("✅ Success! Data returned:");
            console.log(JSON.stringify(data, null, 2));
            break; // Stop trying if one works
        } catch (error: any) {
            console.error(`❌ Failed: ${error.message}`);
            if (error.response?.data) {
                console.error("Response data:", error.response.data);
            }
        }
    }
}

main().catch(console.error);
