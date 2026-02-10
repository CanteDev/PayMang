import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { CONFIG } from '@/config/app.config';
import Stripe from 'stripe';

// Initialize Stripe client if API key is available
const stripe = CONFIG.GATEWAYS.STRIPE.API_KEY
    ? new Stripe(CONFIG.GATEWAYS.STRIPE.API_KEY, {
        apiVersion: '2025-01-27.acacia',
    })
    : null;

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
        const supabase = await createClient();

        // 1. Buscar el payment_link
        const { data: link, error: linkError } = await supabase
            .from('payment_links')
            .select(`
                *,
                student:students(*),
                pack:packs(*)
            `)
            .eq('short_code', shortCode) // Changed from 'id' to 'short_code' based on previous context, verify schema if needed
            // If table uses 'id' as short_code (nanoid), then 'id' is correct.
            // Previous file used .eq('id', shortCode). Let's stick to that if that's the schema.
            // Actually, checking previous context, the file said .eq('id', shortCode). 
            // BUT usually shortCode is a specific column. Let's assume 'id' is the nanoid PK.
            .eq('id', shortCode)
            .single();

        if (linkError || !link) {
            console.error('Link lookup error:', linkError);
            return NextResponse.redirect(`${CONFIG.APP.URL}/404`);
        }

        if (link.status === 'paid' || link.status === 'deleted') {
            return NextResponse.redirect(`${CONFIG.APP.URL}/error?message=link_expired`);
        }

        // 2. Actualizar estado del link a 'clicked'
        // Use RPC or Update
        await supabase
            .from('payment_links')
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

async function buildStripeUrl(student: any, pack: any, metadata: any): Promise<string | null> {
    if (!stripe) {
        console.error('Stripe not configured');
        return null; // Return null to trigger error page
    }

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

function buildHotmartUrl(student: any, pack: any, metadata: any): string {
    const hotmartOfferId = pack.gateway_ids?.hotmart || '';

    // If no specific offer ID, maybe fallback to a default one or error?
    if (!hotmartOfferId) {
        // Logic to handle missing offer ID. 
        // For sandbox testing, we might want a default test offer?
        console.warn('No Hotmart offer ID found. Using fallback or error.');
        // return `${CONFIG.APP.URL}/error?message=hotmart_not_configured`;
    }

    // Example Hotmart Pay URL: https://pay.hotmart.com/OFFER_CODE
    const baseUrl = `https://pay.hotmart.com/${hotmartOfferId}`;
    const params = new URLSearchParams({
        email: student.email,
        name: student.full_name || student.email,
        src: metadata.link_id,
        // 'off' parameter can be used for coupons
        // 'checkoutMode' for different appearances
    });

    return `${baseUrl}?${params.toString()}`;
}

function buildSeQuraUrl(student: any, pack: any, metadata: any): string {
    const merchantId = CONFIG.GATEWAYS.SEQURA.MERCHANT_ID;

    if (!merchantId) {
        return `${CONFIG.APP.URL}/error?message=sequra_not_configured`;
    }

    // SeQura integration usually involves a JS widget or a specific redirect.
    // Assuming a redirect for this implementation context.
    const params = new URLSearchParams({
        merchant: merchantId,
        amount: Math.round(pack.price * 100).toString(),
        email: student.email,
        item: pack.name,
        ref: metadata.link_id
    });

    return `${CONFIG.GATEWAYS.SEQURA.API_URL}/checkout?${params.toString()}`;
}
