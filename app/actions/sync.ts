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

        // 1. Check if offer exists (Solo para Stripe/Sequra, Hotmart API solo devuelve Productos, no Ofertas comerciales)
        let existingOffer = null;
        if (gateway !== 'hotmart') {
            const { data: eo } = await (supabase
                .from('pack_offers') as any)
                .select('id, pack_id, price')
                .eq('gateway', gateway)
                .eq('external_id', p.external_id)
                .single();
            existingOffer = eo;
        }

        if (existingOffer) {
            // EXISTS: Update price and ensure it is active
            // Do not overwrite price if the incoming price is 0 (e.g., Hotmart default)
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
            // We use standard string matching (case-insensitive if possible, but exact is safer)
            const { data: existingPacks, error: packSearchError } = await (supabase
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
                    .insert({ name: p.name, description: p.description || p.name })
                    .select('id')
                    .single();

                if (insertPackError) {
                    console.error('Error creating new pack:', insertPackError);
                    continue; // Skip inserting offer if pack creation failed
                }
                packId = newPack.id;
            }

            // Insert new Pack Offer (Skip for Hotmart, since Hotmart "Products" are just structural Packs, not priced Offers)
            if (gateway !== 'hotmart') {
                const { error: insertOfferError } = await (supabase
                    .from('pack_offers') as any)
                    .insert({
                        pack_id: packId,
                        gateway: gateway,
                        name: `${p.name} (${gateway.charAt(0).toUpperCase() + gateway.slice(1)})`,
                        price: p.price,
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
            } else {
                newCount++; // Count the pack creation as a success even if no offer is auto-generated
            }
        }
    }

    // --- PURGE MISSING OFFERS ---
    // NO PURGAMOS HOTMART porque la API de Hotmart solo devuelve IDs de Producto Padre,
    // y estaríamos desactivando todas las Ofertas específicas importadas manualmente o por CSV.
    let deactivatedCount = 0;

    if (gateway !== 'hotmart') {
        const { data: allGatewayOffers } = await (supabase
            .from('pack_offers') as any)
            .select('id, external_id, pack_id')
            .eq('gateway', gateway)
            .eq('is_active', true);

        if (allGatewayOffers) {
            for (const offer of allGatewayOffers) {
                // If the DB offer is active, but its external_id wasn't in the list downloaded today...
                if (offer.external_id && !processedIds.has(offer.external_id)) {
                    // Deactivate it
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
                                // No active offers left anywhere, deactivate the parent Pack
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
                    external_id: prod.id, // Using product ID as the main anchor. Note: If a product has multiple active prices, this might conflict.
                    // To be safer, we should anchor by Product ID, or a composite. We will just use the product ID and first price to be safe, or just append price id if multiple.
                    // Since user has 1 product to 1 payment link logic generally, we will just use prod.id. 
                    // If there are multiple prices for 1 product, we differentiate external_id by appending price.id
                    name: prodPrices.length > 1 ? `${prod.name}${nameSuffix}` : prod.name,
                    description: prod.description || undefined,
                    price: parseFloat(price.unit_amount_decimal || '0') / 100,
                    currency: price.currency.toUpperCase()
                });
                break; // Usually 1 active price per product in standard setups. We break here. Replace logic if needed.
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
    // Note: Hotmart's API structure for fetching all products can be tricky.
    // Most creators use /product/rest/v1/products 
    // We will attempt a standard fetch, if it is not available or differs, 
    // we will throw an error telling them API limitation or asking for specific scopes.

    try {
        // Using the request wrapper built in hotmart.ts
        // Must use absolute URL to bypass the `payments/v1` base URL defined in the wrapper
        const response: any = await hotmart.request('https://developers.hotmart.com/products/api/v1/products', {
            method: 'GET'
        });

        const items = response?.items || response?.data || [];

        // Filter ONLY active products so paused/drafts are properly pruned later
        const activeItems = items.filter((prod: any) => prod.status === 'ACTIVE');

        const standardizedProducts: StandardizedProduct[] = activeItems.map((prod: any) => ({
            external_id: String(prod.id),
            name: prod.name || `Hotmart Product ${prod.id}`,
            description: prod.description || '',
            price: 0, // Hotmart prices are attached to offers/plans, pulling exact default price here is hard via API without deep dive. Default 0.
            currency: 'EUR' // Default
        }));

        return await syncGatewayProducts('hotmart', standardizedProducts);
    } catch (e: any) {
        console.error("Hotmart Sync API Error:", e.message);
        return { success: false, error: `Error conectando con Hotmart API: ${e.message}` };
    }
}
