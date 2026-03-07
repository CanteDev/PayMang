'use server';

import { createClient } from '@/lib/supabase/server';
import { getGatewayConfig } from '@/lib/settings-helper';
import Stripe from 'stripe';
import { hotmart } from '@/lib/hotmart';

export interface StandardizedProduct {
    external_id: string; // The specific API ID
    name: string;        // The base Pack name
    offer_name?: string; // The specific name for this offer (e.g. 'Precio Base', '1st Upgrade')
    description?: string;
    price: number;
    currency: string;
    checkout_url?: string; // If available directly from API
    is_main_offer?: boolean; // Hotmart flags which offer is the main one
}

export async function syncGatewayProducts(gateway: 'stripe' | 'hotmart', products: StandardizedProduct[]) {
    const supabase = await createClient();

    // Verify Admin
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { success: false, error: 'Usuario no autenticado' };

    let newCount = 0;
    let updatedCount = 0;

    // We will keep track of which external_ids we processed to know which ones to deactivate later
    const processedIds = new Set<string>();

    // ----------------------------------------------------
    // PHASE 1: Group offers by Pack Name and find Base Price
    // ----------------------------------------------------
    const groupedProducts = new Map<string, StandardizedProduct[]>();
    for (const p of products) {
        processedIds.add(p.external_id);
        if (!groupedProducts.has(p.name)) {
            groupedProducts.set(p.name, []);
        }
        groupedProducts.get(p.name)!.push(p);
    }

    // ----------------------------------------------------
    // PHASE 2 & 3: Iterate Groups -> Upsert Pack -> Upsert Offers
    // ----------------------------------------------------

    // Fetch default commission rates once
    let defaultCloserAuth = 8;
    let defaultCoachAuth = 10;
    let defaultSetterAuth = 1;

    const { data: comRatesData } = await supabase.from('app_settings').select('value').eq('key', 'commission_rates').maybeSingle<any>();
    if (comRatesData && comRatesData.value) {
        const valCloser = comRatesData.value.closer || 0.08;
        const valCoach = comRatesData.value.coach || 0.10;
        const valSetter = comRatesData.value.setter || 0.01;
        defaultCloserAuth = valCloser < 1 ? valCloser * 100 : valCloser;
        defaultCoachAuth = valCoach < 1 ? valCoach * 100 : valCoach;
        defaultSetterAuth = valSetter < 1 ? valSetter * 100 : valSetter;
    }

    for (const [packName, offers] of groupedProducts.entries()) {

        // Find best Base Price for this Pack
        let basePrice = 0;
        const mainOffer = offers.find(o => o.is_main_offer);
        if (mainOffer && mainOffer.price > 0) {
            basePrice = mainOffer.price;
        } else {
            // Fallback: lowest positive price
            const validPrices = offers.map(o => o.price).filter(p => p > 0);
            if (validPrices.length > 0) {
                basePrice = Math.min(...validPrices);
            }
        }

        const packDescription = offers.find(o => o.description)?.description || packName;

        // -- UPSERT PACK --
        const { data: existingPacks } = await (supabase.from('packs') as any)
            .select('id, name, price, is_active')
            .eq('name', packName)
            .limit(1);

        let currentPackId = null;

        if (existingPacks && existingPacks.length > 0) {
            currentPackId = existingPacks[0].id;
            const updatePayload: any = {};

            if (!existingPacks[0].is_active) {
                updatePayload.is_active = true;
            }

            // Only update DB price if it was 0 or unset.
            if ((!existingPacks[0].price || existingPacks[0].price === 0) && basePrice > 0) {
                updatePayload.price = basePrice;
            }

            if (Object.keys(updatePayload).length > 0) {
                await (supabase.from('packs') as any).update(updatePayload).eq('id', currentPackId);
            }
        } else {
            // Completely new Pack
            const { data: newPack, error: insertPackError } = await (supabase.from('packs') as any)
                .insert({
                    name: packName,
                    description: packDescription,
                    price: basePrice, // Assign our best guess base price directly on creation!
                    commission_closer: defaultCloserAuth,
                    commission_coach: defaultCoachAuth,
                    commission_setter: defaultSetterAuth
                })
                .select('id')
                .single();

            if (insertPackError) {
                console.error('Error creating new pack:', insertPackError);
                continue; // Skip inserting offers if pack creation failed
            }
            currentPackId = newPack.id;
        }

        // -- UPSERT OFFERS --
        for (const offer of offers) {
            const { data: existingOffer } = await (supabase.from('pack_offers') as any)
                .select('id, price')
                .eq('gateway', gateway)
                .eq('external_id', offer.external_id)
                .maybeSingle();

            if (existingOffer) {
                // Update
                const updatePayload: any = {
                    is_active: true,
                    updated_at: new Date().toISOString()
                };

                if (offer.price > 0 || gateway === 'stripe') {
                    updatePayload.price = offer.price;
                }
                if (offer.offer_name) {
                    updatePayload.name = offer.offer_name;
                }

                const { error: updateError } = await (supabase.from('pack_offers') as any)
                    .update(updatePayload)
                    .eq('id', existingOffer.id);

                if (updateError) {
                    console.error(`Error updating offer ${existingOffer.id}:`, updateError);
                } else if (updatePayload.price !== undefined && existingOffer.price !== updatePayload.price) {
                    updatedCount++;
                }
            } else {
                // Insert
                const { error: insertOfferError } = await (supabase.from('pack_offers') as any)
                    .insert({
                        pack_id: currentPackId,
                        gateway: gateway,
                        name: offer.offer_name || `${offer.name} (${gateway.charAt(0).toUpperCase() + gateway.slice(1)})`,
                        price: offer.price || 0,
                        currency: offer.currency,
                        external_id: offer.external_id,
                        checkout_url: offer.checkout_url || '',
                        is_active: true
                    });

                if (insertOfferError) {
                    console.error(`Error creating new offer for ${offer.external_id}:`, insertOfferError);
                } else {
                    newCount++;
                }
            }
        }
    }

    // ----------------------------------------------------
    // PHASE 4: PURGE MISSING OFFERS
    // ----------------------------------------------------
    let deactivatedCount = 0;

    // Only fetch offers that were created by sync (have an external_id)
    const { data: allGatewayOffers } = await (supabase.from('pack_offers') as any)
        .select('id, external_id, pack_id')
        .eq('gateway', gateway)
        .eq('is_active', true)
        .not('external_id', 'is', null);

    if (allGatewayOffers) {
        // Track which packs had at least one synced offer deactivated
        const affectedPackIds = new Set<string>();

        for (const offer of allGatewayOffers) {
            // If not found in current API response -> deactivate
            if (!processedIds.has(offer.external_id)) {
                const { error: deactivateError } = await (supabase.from('pack_offers') as any)
                    .update({ is_active: false })
                    .eq('id', offer.id);

                if (!deactivateError) {
                    deactivatedCount++;
                    if (offer.pack_id) {
                        affectedPackIds.add(offer.pack_id);
                    }
                }
            }
        }

        // For each affected pack: cascade-deactivate manual offers + pack if needed
        for (const packId of affectedPackIds) {
            // Step 1: Check if any synced (external_id) offers remain active for this gateway
            const { count: syncedActiveCount } = await (supabase.from('pack_offers') as any)
                .select('id', { count: 'exact', head: true })
                .eq('pack_id', packId)
                .eq('gateway', gateway)
                .eq('is_active', true)
                .not('external_id', 'is', null);

            // Step 2: If no synced offers remain, also deactivate manual offers of same gateway.
            // A manual Stripe offer is useless if no real Stripe product exists in production.
            if (syncedActiveCount === 0) {
                await (supabase.from('pack_offers') as any)
                    .update({ is_active: false })
                    .eq('pack_id', packId)
                    .eq('gateway', gateway)
                    .is('external_id', null)
                    .eq('is_active', true);
            }

            // Step 3: Check if the pack has ANY active offers left across ALL gateways
            const { count: totalActiveCount } = await (supabase.from('pack_offers') as any)
                .select('id', { count: 'exact', head: true })
                .eq('pack_id', packId)
                .eq('is_active', true);

            if (totalActiveCount === 0) {
                // No active offers left in any gateway -> deactivate the parent Pack
                await (supabase.from('packs') as any)
                    .update({ is_active: false })
                    .eq('id', packId);
            }
        }
    }

    return { success: true, newCount, updatedCount, deactivatedCount };

}

export async function processStripeSync() {
    console.log("Starting Stripe Sync...");
    try {
        const config = await getGatewayConfig('stripe');
        const secretKey = config.secret_key || config.SECRET_KEY;

        if (!secretKey) return { success: false, error: 'Stripe API Key no configurada' };

        const stripe = new Stripe(secretKey, { apiVersion: '2023-10-16' as any });

        // Fetch active products
        const productsResponse = await stripe.products.list({ active: true, limit: 100 });
        const pricesResponse = await stripe.prices.list({ active: true, limit: 100 });

        const standardizedProducts: StandardizedProduct[] = [];

        for (const prod of productsResponse.data) {
            const prodPrices = pricesResponse.data.filter((pri: any) => pri.product === prod.id);

            for (const price of prodPrices) {
                let nameSuffix = '';
                if (price.type === 'recurring') {
                    nameSuffix = ` (Recurrente ${price.recurring?.interval_count} ${price.recurring?.interval})`;
                } else if (prodPrices.length > 1) {
                    nameSuffix = ' (Pago Único)';
                }

                standardizedProducts.push({
                    external_id: price.id, // CRITICAL: Use Price ID, not Product ID
                    name: prod.name,
                    offer_name: `${prod.name}${nameSuffix} (Stripe)`,
                    description: prod.description || undefined,
                    price: parseFloat(price.unit_amount_decimal || '0') / 100,
                    currency: price.currency.toUpperCase()
                });
            }
        }

        // Ensure unique external IDs in case of multiples
        const uniqueProducts = Array.from(new Map(standardizedProducts.map(p => [p.external_id, p])).values());

        return await syncGatewayProducts('stripe', uniqueProducts);
    } catch (e: any) {
        console.error("Stripe Sync API Error:", e.message);
        return { success: false, error: `Error conectando con Stripe API: ${e.message}` };
    }
}

export async function processHotmartSync() {
    console.log("Starting Hotmart Sync...");
    try {
        const response: any = await hotmart.request('https://developers.hotmart.com/products/api/v1/products?max_results=50', {
            method: 'GET'
        });

        const items = response?.items || response?.data || [];
        // Filter ONLY active products
        const activeItems = items.filter((prod: any) => prod.status === 'ACTIVE');

        const standardizedProducts: StandardizedProduct[] = [];

        for (const prod of activeItems) {
            const productName = prod.name || `Hotmart Product ${prod.id}`;
            const packDesc = prod.description || '';

            if (prod.ucode) {
                try {
                    // Fetch real offers for this product using its ucode (this is how we get prices and offer codes)
                    const offersResponse: any = await hotmart.request(`https://developers.hotmart.com/products/api/v1/products/${prod.ucode}/offers?max_results=50`);
                    const offers = offersResponse?.items || [];

                    if (offers.length > 0) {
                        for (const offer of offers) {
                            let specificOfferName = offer.name;
                            if (!specificOfferName) {
                                specificOfferName = offer.is_main_offer ? 'Precio Base' : 'Oferta Hotmart';
                            } else {
                                // Sometimes names just come as "1st Upgrade", append Hotmart for clarity if desired.
                                // Actually, let's keep it clean as requested.
                            }

                            standardizedProducts.push({
                                external_id: offer.code,
                                name: productName,
                                offer_name: specificOfferName,
                                description: packDesc,
                                price: offer.price?.value || 0,
                                currency: offer.price?.currency_code || 'EUR',
                                checkout_url: `https://pay.hotmart.com/${prod.ucode}?checkoutMode=10&off=${offer.code}`,
                                is_main_offer: offer.is_main_offer === true
                            });
                        }
                    } else {
                        // Fallback: Product has no offers returned, create a placeholder with ID so pack is generated
                        standardizedProducts.push({
                            external_id: String(prod.id),
                            name: productName,
                            description: packDesc,
                            price: 0,
                            currency: 'EUR',
                            checkout_url: `https://pay.hotmart.com/${prod.ucode}?checkoutMode=10`
                        });
                    }
                } catch (offerErr: any) {
                    console.error(`Failed to fetch offers for Hotmart product ${prod.id} (${prod.ucode}):`, offerErr.message);
                    // Fallback to numeric product ID if offers fail completely (to at least sync the pack)
                    standardizedProducts.push({
                        external_id: String(prod.id),
                        name: productName,
                        description: packDesc,
                        price: 0,
                        currency: 'EUR',
                        checkout_url: `https://pay.hotmart.com/${prod.ucode}?checkoutMode=10`
                    });
                }
            } else {
                // If by some reason it has no ucode
                standardizedProducts.push({
                    external_id: String(prod.id),
                    name: productName,
                    description: packDesc,
                    price: 0,
                    currency: 'EUR'
                });
            }
        }

        return await syncGatewayProducts('hotmart', standardizedProducts);
    } catch (e: any) {
        console.error("Hotmart Sync API Error:", e.message);
        return { success: false, error: `Error conectando con Hotmart API: ${e.message}` };
    }
}

export async function processSequraSync() {
    console.log("Starting SeQura Connection Verification...");
    try {
        const config = await getGatewayConfig('sequra');
        const merchantId = config.merchant_id || config.MERCHANT_ID;
        const apiKey = config.api_key || config.API_KEY;
        const environment = config.environment || config.ENVIRONMENT || 'sandbox';
        const apiUrl = environment === 'production'
            ? 'https://live.sequrapi.com'
            : 'https://sandbox.sequrapi.com';

        if (!merchantId || !apiKey) {
            return { success: false, error: 'Credenciales de SeQura no configuradas (Merchant ID y Password son requeridos)' };
        }

        const auth = Buffer.from(`${merchantId}:${apiKey}`).toString('base64');

        const response = await fetch(`${apiUrl}/merchants/${merchantId}/payment_methods`, {
            headers: {
                'Authorization': `Basic ${auth}`,
                'Accept': 'application/json',
            },
        });

        if (!response.ok) {
            const errorText = await response.text().catch(() => response.statusText);
            return { success: false, error: `Error de SeQura API (${response.status}): ${errorText}` };
        }

        const data = await response.json();

        // Extract payment method names from nested structure
        const methods: string[] = [];
        const groups = data?.payment_options || data || [];
        for (const group of (Array.isArray(groups) ? groups : [])) {
            const options = group?.payment_options || [];
            for (const opt of options) {
                if (opt?.product && opt?.title) {
                    methods.push(`${opt.title} (${opt.product})`);
                }
            }
        }

        const message = methods.length > 0
            ? `Conexión correcta. Métodos disponibles: ${methods.join(', ')}`
            : `Conexión correcta con SeQura (entorno: ${environment})`;

        console.log(`✅ SeQura verification OK: ${message}`);
        return { success: true, message, methodCount: methods.length };

    } catch (e: any) {
        console.error("SeQura Sync/Verify Error:", e.message);
        return { success: false, error: `Error conectando con SeQura API: ${e.message}` };
    }
}
