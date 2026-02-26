'use server';

import { createClient } from '@/lib/supabase/server';
import { getGatewayConfig } from '@/lib/settings-helper';
import Stripe from 'stripe';
import { hotmart } from '@/lib/hotmart';

export interface StandardizedProduct {
    external_id: string; // The specific API ID
    name: string;
    description?: string;
    price: number;
    currency: string;
    checkout_url?: string; // If available directly from API
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

    for (const p of products) {
        processedIds.add(p.external_id);

        // 1. Check if offer exists by external_id
        const { data: existingOffer } = await (supabase
            .from('pack_offers') as any)
            .select('id, pack_id, price')
            .eq('gateway', gateway)
            .eq('external_id', p.external_id)
            .maybeSingle();

        if (existingOffer) {
            // EXISTS: Update and ensure it is active.
            // Do NOT overwrite price if the incoming price is 0 (Hotmart API always returns 0)
            const updatePayload: any = {
                is_active: true,
                updated_at: new Date().toISOString()
            };

            if (p.price > 0 || gateway === 'stripe') {
                updatePayload.price = p.price;
            }

            const { error: updateError } = await (supabase
                .from('pack_offers') as any)
                .update(updatePayload)
                .eq('id', existingOffer.id);

            if (updateError) {
                console.error(`Error updating offer ${existingOffer.id}:`, updateError);
            } else if (updatePayload.price !== undefined && existingOffer.price !== updatePayload.price) {
                updatedCount++;
            }
        } else {
            // DOES NOT EXIST: Create or Link Pack, then Create Offer

            // Search for existing pack with EXACT SAME NAME
            const { data: existingPacks } = await (supabase
                .from('packs') as any)
                .select('id, name, is_active')
                .eq('name', p.name)
                .limit(1);

            let packId = null;

            if (existingPacks && existingPacks.length > 0) {
                packId = existingPacks[0].id;
                // Make sure the pack is active, in case it was previously deleted/deactivated
                if (!existingPacks[0].is_active) {
                    await (supabase.from('packs') as any)
                        .update({ is_active: true })
                        .eq('id', packId);
                }
            } else {
                // Completely new Pack
                const { data: newPack, error: insertPackError } = await (supabase
                    .from('packs') as any)
                    .insert({
                        name: p.name,
                        description: p.description || p.name,
                        price: p.price || 0
                    })
                    .select('id')
                    .single();

                if (insertPackError) {
                    console.error('Error creating new pack:', insertPackError);
                    continue; // Skip inserting offer if pack creation failed
                }
                packId = newPack.id;
            }

            // Insert new Pack Offer
            // For Hotmart: price will be 0 (admin sets it manually); existing offers are never overwritten with 0
            const { error: insertOfferError } = await (supabase
                .from('pack_offers') as any)
                .insert({
                    pack_id: packId,
                    gateway: gateway,
                    name: `${p.name} (${gateway.charAt(0).toUpperCase() + gateway.slice(1)})`,
                    price: p.price || 0,
                    currency: p.currency,
                    external_id: p.external_id,
                    checkout_url: p.checkout_url || '',
                    is_active: true
                });

            if (insertOfferError) {
                console.error(`Error creating new offer for ${p.external_id}:`, insertOfferError);
            } else {
                newCount++;
            }
        }
    }

    // --- PURGE MISSING OFFERS ---
    // Deactivate offers whose external_id is no longer in the current platform list.
    // For Hotmart: ONLY deactivate offers whose external_id is a pure numeric product ID
    // (those created by this sync). Alphanumeric offer codes (manually added) are never touched.
    let deactivatedCount = 0;

    const { data: allGatewayOffers } = await (supabase
        .from('pack_offers') as any)
        .select('id, external_id, pack_id')
        .eq('gateway', gateway)
        .eq('is_active', true);

    if (allGatewayOffers) {
        for (const offer of allGatewayOffers) {
            if (!offer.external_id) continue;

            // If this offer's external_id was not in the current platform list → deactivate it
            if (!processedIds.has(offer.external_id)) {
                const { error: deactivateError } = await (supabase
                    .from('pack_offers') as any)
                    .update({ is_active: false })
                    .eq('id', offer.id);

                if (!deactivateError) {
                    deactivatedCount++;

                    // Check if parent Pack has ANY active offers left across ALL gateways
                    if (offer.pack_id) {
                        const { count, error: countError } = await (supabase
                            .from('pack_offers') as any)
                            .select('id', { count: 'exact', head: true })
                            .eq('pack_id', offer.pack_id)
                            .eq('is_active', true);

                        if (!countError && count === 0) {
                            // No active offers left anywhere → deactivate the parent Pack
                            await (supabase
                                .from('packs') as any)
                                .update({ is_active: false })
                                .eq('id', offer.pack_id);
                        }
                    }
                }
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
                    nameSuffix = ` (${price.recurring?.interval_count} ${price.recurring?.interval})`;
                }

                standardizedProducts.push({
                    external_id: prod.id,
                    name: prodPrices.length > 1 ? `${prod.name}${nameSuffix}` : prod.name,
                    description: prod.description || undefined,
                    price: parseFloat(price.unit_amount_decimal || '0') / 100,
                    currency: price.currency.toUpperCase()
                });
                break; // Usually 1 active price per product in standard setups
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
                            standardizedProducts.push({
                                external_id: offer.code,
                                name: productName,
                                description: packDesc,
                                price: offer.price?.value || 0,
                                currency: offer.price?.currency_code || 'EUR',
                                checkout_url: `https://pay.hotmart.com/${prod.ucode}?checkoutMode=10&off=${offer.code}`
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
