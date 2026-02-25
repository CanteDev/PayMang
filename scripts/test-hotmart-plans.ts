import { createClient } from '@supabase/supabase-js';
import { HotmartClient } from '../lib/hotmart';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
    console.log("Loading config...");
    const { data: configRows } = await supabase.from('app_settings').select('*').eq('key', 'hotmart_config').single();
    const config = configRows?.value;
    const hotmart = HotmartClient.getInstance();

    // Let's test the Plans API for the MENTE MAESTRA subscription (ID: 4174586, ucode: a1fc6557-9527-4812-bbe9-216b970bcad0)
    console.log("Testing Plans API for MENTE MAESTRA...");
    try {
        const plans = await hotmart.request<any>(`https://sandbox.hotmart.com/payments/api/v1/plans?product_id=4174586`);
        console.log(JSON.stringify(plans, null, 2));
    } catch (e) {
        console.error("Plans API Error (sandbox):", e);
    }

    try {
        const plans = await hotmart.request<any>(`https://developers.hotmart.com/payments/api/v1/plans?product_id=4174586`);
        console.log(JSON.stringify(plans, null, 2));
    } catch (e) {
        console.error("Plans API Error (developers):", e);
    }
}
main();
