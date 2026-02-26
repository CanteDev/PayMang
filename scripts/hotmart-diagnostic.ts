import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function getHotmartConfig() {
    const { data } = await supabase
        .from('app_settings')
        .select('value')
        .eq('key', 'hotmart_config')
        .single();
    return (data?.value || {}) as any;
}

async function getToken(cfg: any) {
    let auth = cfg.BASIC_AUTH || cfg.basic_auth;
    if (auth && !auth.toLowerCase().startsWith('basic ')) auth = 'Basic ' + auth;
    const r = await fetch('https://api-sec-vlc.hotmart.com/security/oauth/token?grant_type=client_credentials', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: auth }
    });
    const d = await r.json() as any;
    if (!d.access_token) throw new Error('Token error: ' + JSON.stringify(d));
    return d.access_token as string;
}

async function tryEndpoint(label: string, url: string, token: string) {
    console.log(`\n========== ${label} ==========`);
    console.log('URL:', url);
    const r = await fetch(url, { headers: { Authorization: 'Bearer ' + token } });
    const text = await r.text();
    console.log('Status:', r.status);
    try {
        const json = JSON.parse(text);
        console.log(JSON.stringify(json, null, 2).substring(0, 3000));
    } catch {
        console.log(text.substring(0, 1000));
    }
    return r.status;
}

async function main() {
    console.log('Loading Hotmart config from app_settings...');
    const cfg = await getHotmartConfig();
    console.log('Config keys found:', Object.keys(cfg).join(', '));

    const token = await getToken(cfg);
    console.log('✅ Token obtained');

    // 1. List all products
    await tryEndpoint(
        '1. ALL PRODUCTS',
        'https://developers.hotmart.com/products/api/v1/products',
        token
    );

    // Pick a specific product to drill into (BLACK FRIDAY 25 = 6637723, Llamada con Coach = 4622507)
    const TEST_PRODUCT_ID = '6637723';

    // 2. Single product detail
    await tryEndpoint(
        '2. SINGLE PRODUCT DETAIL',
        `https://developers.hotmart.com/products/api/v1/products/${TEST_PRODUCT_ID}`,
        token
    );

    // 3. Product offers (has been returning 500 but let's see raw response)
    await tryEndpoint(
        '3. PRODUCT OFFERS',
        `https://developers.hotmart.com/products/api/v1/products/${TEST_PRODUCT_ID}/offers`,
        token
    );

    // 4. Product prices
    await tryEndpoint(
        '4. PRODUCT PRICES',
        `https://developers.hotmart.com/products/api/v1/products/${TEST_PRODUCT_ID}/prices`,
        token
    );

    // 5. Try the v2 API
    await tryEndpoint(
        '5. PRODUCTS V2',
        'https://developers.hotmart.com/products/api/v2/products',
        token
    );

    // 6. Try the checkout API (sometimes has offer info)
    await tryEndpoint(
        '6. CHECKOUT INFO',
        `https://developers.hotmart.com/products/api/v1/products/${TEST_PRODUCT_ID}/checkout`,
        token
    );

    // 7. Full sales history one item  
    await tryEndpoint(
        '7. SALES HISTORY (1 item)',
        'https://developers.hotmart.com/payments/api/v1/sales/history?max_results=1',
        token
    );

    // 8. Subscriptions/plans
    await tryEndpoint(
        '8. SUBSCRIPTIONS',
        `https://developers.hotmart.com/payments/api/v1/subscriptions?product_id=${TEST_PRODUCT_ID}&max_results=3`,
        token
    );

    // 9. Try the "offer" endpoint without product ID
    await tryEndpoint(
        '9. ALL OFFERS (no product filter)',
        'https://developers.hotmart.com/products/api/v1/offers',
        token
    );

    // 10. Try product coupons (sometimes has offer pricing)
    await tryEndpoint(
        '10. PRODUCT WITH offers?status=ACTIVE param',
        `https://developers.hotmart.com/products/api/v1/products/${TEST_PRODUCT_ID}/offers?status=ACTIVE`,
        token
    );

    // 11. Test with Llamada con Coach (simpler product, 1 offer)
    await tryEndpoint(
        '11. LLAMADA CON COACH OFFERS',
        'https://developers.hotmart.com/products/api/v1/products/4622507/offers',
        token
    );

    console.log('\n\n✅ Diagnostic complete');
}

main().catch(console.error);
