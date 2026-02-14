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
                pack:packs(*)
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
        const paymentUrl = await buildPaymentUrl(
            link.gateway || 'stripe', // Default to Stripe
            link.student,
            link.pack,
            { link_id: link.id, coach_id: link.created_by, metadata: link.metadata }
        );

        if (!paymentUrl) {
            return NextResponse.redirect(`${CONFIG.APP.URL}/error?message=payment_url_error`);
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
    metadata: any
): Promise<string | null> {
    switch (gateway) {
        case 'stripe':
            return await buildStripeUrl(student, pack, metadata);
        case 'hotmart':
            return buildHotmartUrl(student, pack, metadata);
        case 'sequra':
            return buildSeQuraUrl(student, pack, metadata);
        default:
            return null;
    }
}

import { getGatewayConfig } from '@/lib/settings-helper';

async function buildStripeUrl(student: any, pack: any, metadata: any): Promise<string | null> {
    const config = await getGatewayConfig('stripe');

    if (!config.secret_key) {
        console.error('Stripe not configured');
        return null; // Return null to trigger error page
    }

    const stripe = new Stripe(config.secret_key, {
        apiVersion: '2026-01-28.clover', // Keep consistent
    });

    try {
        const session = await stripe.checkout.sessions.create({
            payment_method_types: ['card'],
            line_items: [
                {
                    price_data: {
                        currency: 'eur',
                        product_data: {
                            name: pack.name,
                            description: pack.description || `Pago por ${pack.name}`,
                        },
                        unit_amount: Math.round(pack.price * 100), // cents
                    },
                    quantity: 1,
                },
            ],
            mode: 'payment',
            success_url: `${CONFIG.APP.URL}/success?session_id={CHECKOUT_SESSION_ID}`,
            cancel_url: `${CONFIG.APP.URL}/cancel`,
            customer_email: student.email,
            metadata: {
                link_id: metadata.link_id,
                student_id: student.id,
                pack_id: pack.id,
                agent_id: metadata.created_by, // Assuming similar to coach_id
                coach_id: metadata.coach_id,
                source: 'paymang_link'
            },
        });

        return session.url;
    } catch (error) {
        console.error('Stripe Session Creation Failed:', error);
        throw error;
    }
}

async function buildHotmartUrl(student: any, pack: any, metadata: any): Promise<string | null> {
    // Get product code and offer ID from pack configuration
    // Product ID should be the public code (e.g., L104393461L)
    const productCode = pack.gateway_ids?.hotmart?.product_id;
    const offerCode = pack.gateway_ids?.hotmart?.offer_id;

    if (!productCode || !offerCode) {
        console.error('Hotmart product/offer code not configured for pack:', pack.id);
        return `${CONFIG.APP.URL}/error?message=hotmart_not_configured`;
    }

    // Correct URL structure discovered: https://pay.hotmart.com/{PRODUCT_CODE}?off={OFFER_CODE}
    const baseUrl = `https://pay.hotmart.com/${productCode}`;

    console.log(`🔗 Generando link Hotmart para Product: ${productCode}, Offer: ${offerCode}`);

    const params = new URLSearchParams({
        off: offerCode,
        checkoutMode: '10',
        email: student.email,
        name: student.full_name || student.email,
        src: metadata.link_id,
        sck: metadata.link_id
    });

    const finalUrl = `${baseUrl}?${params.toString()}`;
    console.log(`👉 URL Final Hotmart: ${finalUrl}`);

    return finalUrl;
}

function buildSeQuraUrl(student: any, pack: any, metadata: any): string {
    // Redirect to internal checkout page to handle Sequra's specific flow (Solicitation -> Form)
    return `${CONFIG.APP.URL}/checkout/sequra/${metadata.link_id}`;
}
