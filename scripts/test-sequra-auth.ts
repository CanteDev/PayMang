import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();
dotenv.config({ path: '.env.local' }); // override with local if exists

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function test() {
    const { data } = await supabase.from('app_settings').select('value').eq('key', 'sequra_config').single();
    const json = data?.value;

    if (!json) {
        console.error('No sequra config found in app_settings');
        process.exit(1);
    }

    const envString = json.environment || json.ENVIRONMENT || 'sandbox';
    const merch = json.merchant_id || json.MERCHANT_ID;
    const key = json.api_key || json.API_KEY;
    const url = envString === 'production' ? 'https://live.sequrapi.com' : 'https://sandbox.sequrapi.com';

    console.log('--- DB Config Debug ---');
    console.log('Environment:', envString);
    console.log(`Merchant: "${merch}"`, `(Length: ${merch?.length})`);
    console.log(`API Key: "${key?.substring(0, 4)}...${key?.substring(key.length - 4)}"`, `(Length: ${key?.length})`);

    console.log('\n--- API Test ---');

    const auth = Buffer.from(`${merch}:${key}`).toString('base64');
    console.log('API URL:', url);
    console.log('Auth Header Prefix:', `Basic ${auth.substring(0, 10)}...`);

    // Test a simple GET request
    const response = await fetch(`${url}/orders`, {
        method: 'GET',
        headers: {
            'Authorization': `Basic ${auth}`,
            'Accept': 'application/json',
        }
    });

    console.log('GET /orders Status:', response.status);
    const text = await response.text();
    console.log('GET /orders Body:', text.substring(0, 150));
}

test().catch(console.error);
