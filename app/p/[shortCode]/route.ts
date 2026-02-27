import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { CONFIG } from '@/config/app.config';
import Stripe from 'stripe';
import { PaymentLinkWithRelations } from '@/types/database';

// Stripe initialized per-request in buildStripeUrl

/**
 * Smart Redirect Handler
 * Redirige desde /p/[shortCode] a la pasarela de pago correspondiente
 */
export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ shortCode: string }> }
) {
    const { shortCode } = await params;

    try {
        // Usar Service Role Key para bypass RLS ya que es un acceso público
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
        const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

        if (!serviceRoleKey) {
            console.error('Service Role Key missing');
            return NextResponse.redirect(`${CONFIG.APP.URL}/error?message=internal_configuration_error`);
        }

        const supabase = createClient(supabaseUrl, serviceRoleKey);

        // 1. Buscar el payment_link
        const { data: link, error: linkError } = await supabase
            .from('payment_links')
            .select(`
                *,
                student:students(*),
                pack:packs(*),
                offer:pack_offers(*)
            `)
            .eq('id', shortCode)
            .single() as { data: PaymentLinkWithRelations | null, error: any };

        if (linkError || !link) {
            console.error('Link lookup error:', linkError);
            return NextResponse.redirect(`${CONFIG.APP.URL}/404`);
        }

        if (link.status === 'paid' || link.status === 'deleted') {
            return NextResponse.redirect(`${CONFIG.APP.URL}/error?message=link_expired`);
        }

        // 2. Actualizar estado del link a 'clicked'
        // Use RPC or Update
        await (supabase
            .from('payment_links') as any)
            .update({ status: 'clicked' })
            .eq('id', shortCode);

        // Also increment clicks if RPC exists, but update is sufficient for now.
        // supabase.rpc('increment_link_clicks', { link_id: link.id }).catch(console.error);


        // 3. Construir URL de pago según la pasarela
        const origin = request.nextUrl.origin;
        const paymentUrl = await buildPaymentUrl(
            link.gateway || 'stripe', // Default to Stripe
            link.student,
            link.pack,
            link.offer,
            { link_id: link.id, coach_id: link.created_by, metadata: link.metadata },
            origin
        );

        if (!paymentUrl) {
            return NextResponse.redirect(`${origin}/error?message=payment_url_error`);
        }

        // 4. Redirigir a la pasarela
        return NextResponse.redirect(paymentUrl);

    } catch (error) {
        console.error('Error en smart redirect:', error);
        return NextResponse.redirect(`${CONFIG.APP.URL}/error?message=internal_server_error`);
    }
}

async function buildPaymentUrl(
    gateway: string,
    student: any,
    pack: any,
    offer: any,
    metadata: any,
    origin: string
): Promise<string | null> {
    switch (gateway) {
        case 'stripe':
            return await buildStripeUrl(student, pack, offer, metadata, origin);
        case 'hotmart':
            return buildHotmartUrl(student, pack, offer, metadata, origin);
        case 'sequra':
            return buildSeQuraUrl(student, pack, metadata, origin);
        default:
            return null;
    }
}

import { getGatewayConfig } from '@/lib/settings-helper';

async function buildStripeUrl(student: any, pack: any, offer: any, metadata: any, origin: string): Promise<string | null> {
    const config = await getGatewayConfig('stripe');
    const secretKey = config.secret_key || config.SECRET_KEY;

    if (!secretKey) {
        console.error('Stripe not configured');
        return null; // Return null to trigger error page
    }

    // SI HAY OFERTA: Usamos el checkout_url directamente (si lo has importado así en Stripe, aunque típicamente en Stripe generas la session aquí)
    // Pero asumiendo que el "checkout_url" de la oferta tiene el enlace de pago directo o queremos seguir generando la sesión dinámica:
    // Si queremos redirigir a un payment link pre-creado de stripe en checkout_url:
    if (offer && offer.checkout_url && offer.checkout_url.startsWith('https://') && !offer.checkout_url.includes('...')) {
        // Option A: redirect to pre-existing Stripe Payment Link
        const url = new URL(offer.checkout_url);
        url.searchParams.set('client_reference_id', metadata.link_id);
        url.searchParams.set('prefilled_email', student.email);
        return url.toString();
    }

    const stripe = new Stripe(secretKey, {
        apiVersion: '2026-01-28.clover', // Keep consistent
    });

    // Sincronizar nombre del cliente antes de crear la sesión
    const stripeCustomerId = await getOrCreateStripeCustomer(stripe, student);

    try {
        const sessionConfig: Stripe.Checkout.SessionCreateParams = {
            payment_method_types: ['card'],
            success_url: `${origin}/success?session_id={CHECKOUT_SESSION_ID}`,
            cancel_url: `${origin}/cancel`,
            customer: stripeCustomerId, // Use customer ID instead of customer_email
            metadata: {
                link_id: metadata.link_id,
                student_id: student.id,
                pack_id: pack.id,
                agent_id: metadata.created_by, // Assuming similar to coach_id
                coach_id: metadata.coach_id,
                source: 'paymang_link',
                offer_id: offer ? offer.id : null
            },
            mode: 'payment',
            line_items: []
        };

        if (offer && offer.gateway === 'stripe' && offer.external_id && offer.external_id.startsWith('price_')) {
            const stripePrice = await stripe.prices.retrieve(offer.external_id);
            sessionConfig.line_items = [
                {
                    price: offer.external_id,
                    quantity: 1,
                },
            ];
            sessionConfig.mode = stripePrice.type === 'recurring' ? 'subscription' : 'payment';
        } else {
            sessionConfig.line_items = [
                {
                    price_data: {
                        currency: offer ? offer.currency : 'eur',
                        product_data: {
                            name: offer ? offer.name : pack.name,
                            description: pack.description || `Pago por ${pack.name}`,
                        },
                        unit_amount: Math.round((offer ? offer.price : pack.price) * 100), // cents
                    },
                    quantity: 1,
                },
            ];
            sessionConfig.mode = 'payment';
        }

        const session = await stripe.checkout.sessions.create(sessionConfig);

        return session.url;
    } catch (error) {
        console.error('Stripe Session Creation Failed:', error);
        throw error;
    }
}

async function getOrCreateStripeCustomer(stripe: Stripe, student: any): Promise<string> {
    try {
        // 1. Buscar por email
        const customers = await stripe.customers.list({
            email: student.email,
            limit: 1
        });

        if (customers.data.length > 0) {
            const customer = customers.data[0];

            // 2. Si el nombre es diferente, actualizarlo (evita el "blabla")
            if (customer.name !== student.full_name) {
                console.log(`Updating Stripe customer name for ${student.email}: ${customer.name} -> ${student.full_name}`);
                await stripe.customers.update(customer.id, {
                    name: student.full_name
                });
            }
            return customer.id;
        }

        // 3. Si no existe, crearlo
        console.log(`Creating new Stripe customer for ${student.email} with name ${student.full_name}`);
        const newCustomer = await stripe.customers.create({
            email: student.email,
            name: student.full_name,
            metadata: {
                paymang_student_id: student.id
            }
        });

        return newCustomer.id;
    } catch (err) {
        console.error('Error in getOrCreateStripeCustomer:', err);
        // Fallback: if this fails, we can either throw or try to continue with session creation using email
        // but since we want consistency, throwing is safer to investigate errors.
        throw err;
    }
}

async function buildHotmartUrl(student: any, pack: any, offer: any, metadata: any, origin: string): Promise<string | null> {

    // NEW LOGIC WITH OFFERS
    if (offer && offer.checkout_url) {
        console.log(`🔗 Usando URL de Oferta Hotmart: ${offer.name}`);
        const url = new URL(offer.checkout_url);

        // Añadir parámetros de tracking comunes
        url.searchParams.set('email', student.email);
        url.searchParams.set('name', student.full_name || student.email);
        url.searchParams.set('src', metadata.link_id);
        url.searchParams.set('sck', metadata.link_id);

        console.log(`👉 URL Final Hotmart (desde Oferta): ${url.toString()}`);
        return url.toString();
    }

    // LEGACY FALLBACK FOR PACKS WITHOUT OFFERS
    const productCode = pack.gateway_ids?.hotmart?.product_id;
    const offerCode = pack.gateway_ids?.hotmart?.offer_id;

    if (!productCode || !offerCode) {
        console.error('Hotmart product/offer code not configured for pack:', pack.id);
        return `${origin}/error?message=hotmart_not_configured`;
    }

    const baseUrl = `https://pay.hotmart.com/${productCode}`;

    console.log(`🔗 Generando link Hotmart Legacy para Product: ${productCode}, Offer: ${offerCode}`);

    const params = new URLSearchParams({
        off: offerCode,
        checkoutMode: '10',
        email: student.email,
        name: student.full_name || student.email,
        src: metadata.link_id,
        sck: metadata.link_id
    });

    const finalUrl = `${baseUrl}?${params.toString()}`;
    console.log(`👉 URL Final Hotmart Legacy: ${finalUrl}`);

    return finalUrl;
}

function buildSeQuraUrl(student: any, pack: any, metadata: any, origin: string): string {
    // Redirect to internal checkout page to handle Sequra's specific flow (Solicitation -> Form)
    return `${origin}/checkout/sequra/${metadata.link_id}`;
}
