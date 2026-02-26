import 'dotenv/config';
import { hotmart } from '../lib/hotmart';

async function main() {
    console.log('Testing Hotmart Offers API with UCODE');

    // Black Friday Mente Maestra Ucode: 04c268a1-b898-478d-98cd-aae1a892470c
    const ucode = '04c268a1-b898-478d-98cd-aae1a892470c';

    try {
        const url = `https://developers.hotmart.com/products/api/v1/products/${ucode}/offers?max_results=50`;
        console.log('Fetching:', url);
        const offersResponse = await hotmart.request<any>(url);
        console.log(JSON.stringify(offersResponse, null, 2));
    } catch (e: any) {
        console.error('Error:', e.message);
    }
}

main();
