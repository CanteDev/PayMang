import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function getHotmartToken() {
    const { data: config } = await supabase
        .from('app_settings')
        .select('value')
        .eq('key', 'hotmart_config')
        .single();
    const cfg: any = config?.value || {};
    let auth = cfg.BASIC_AUTH || cfg.basic_auth;
    if (auth && !auth.toLowerCase().startsWith('basic ')) auth = 'Basic ' + auth;

    const r = await fetch('https://api-sec-vlc.hotmart.com/security/oauth/token?grant_type=client_credentials', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: auth }
    });
    const d = await r.json() as any;
    return d.access_token as string;
}

async function main() {
    const token = await getHotmartToken();
    const hdr = { Authorization: 'Bearer ' + token };

    // Scan sales/history to collect unique offer info per product
    let pageToken = '';
    const offerMap: Record<string, any> = {};
    let pageCount = 0;

    console.log('Scanning sales/history...');
    do {
        const url = 'https://developers.hotmart.com/payments/api/v1/sales/history?max_results=50' +
            (pageToken ? '&page_token=' + pageToken : '');
        const r = await fetch(url, { headers: hdr });
        const data = await r.json() as any;
        const items: any[] = data.items || [];
        pageToken = data.page_info?.next_page_token || '';
        pageCount++;

        for (const item of items) {
            const productId = String(item.product?.id || '');
            const offerCode = item.purchase?.offer?.code || '';
            const offerName = item.purchase?.offer?.name || item.purchase?.offer?.key || '';
            const currency = item.purchase?.original_offer_price?.currency_code || 'EUR';
            const priceVal = item.purchase?.original_offer_price?.value || 0;
            const productName = item.product?.name || '';

            // Also get the checkout URL format
            const checkoutUrl = offerCode ? `https://pay.hotmart.com/${productId}?offDiscount=${offerCode}` : '';

            const key = productId + '_' + offerCode;
            if (productId && offerCode && !offerMap[key]) {
                offerMap[key] = { productId, productName, offerCode, offerName, priceVal, currency, checkoutUrl };
            }
        }

        if (pageCount >= 20) break; // Safety limit
    } while (pageToken);

    console.log(`Pages scanned: ${pageCount} | Unique product+offer combos: ${Object.keys(offerMap).length}`);
    console.log('\n=== OFFERS FOUND ===');
    for (const o of Object.values(offerMap)) {
        console.log(`  Product #${o.productId} "${o.productName}" | Offer: ${o.offerCode} "${o.offerName}" | Price: ${o.priceVal} ${o.currency}`);
    }
}

main().catch(console.error);
