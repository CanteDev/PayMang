import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { CONFIG } from '@/config/app.config';

/**
 * Smart Redirect Handler
 * Redirige desde /p/[shortCode] a la pasarela de pago correspondiente
 */
export async function GET(
    request: NextRequest,
    { params }: { params: { shortCode: string } }
) {
    const { shortCode } = params;

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
            .eq('id', shortCode)
            .eq('status', 'pending')
            .single();

        if (linkError || !link) {
            return NextResponse.json(
                { error: 'Link no encontrado o ya utilizado' },
                { status: 404 }
            );
        }

        // 2. Actualizar estado del link a 'clicked'
        await supabase
            .from('payment_links')
            .update({ status: 'clicked' })
            .eq('id', shortCode);

        // 3. Construir URL de pago según la pasarela
        const paymentUrl = buildPaymentUrl(
            link.gateway,
            link.student,
            link.pack,
            shortCode
        );

        if (!paymentUrl) {
            return NextResponse.json(
                { error: 'No se pudo construir la URL de pago' },
                { status: 500 }
            );
        }

        // 4. Redirigir a la pasarela
        return NextResponse.redirect(paymentUrl);

    } catch (error) {
        console.error('Error en smart redirect:', error);
        return NextResponse.json(
            { error: 'Error interno del servidor' },
            { status: 500 }
        );
    }
}

/**
 * Construye la URL de pago según la pasarela
 */
function buildPaymentUrl(
    gateway: string,
    student: any,
    pack: any,
    shortCode: string
): string | null {
    const baseUrl = CONFIG.APP.URL;
    const metadata = {
        link_id: shortCode,
        student_id: student.id,
        pack_id: pack.id,
    };

    switch (gateway) {
        case 'stripe':
            return buildStripeUrl(student, pack, metadata);

        case 'hotmart':
            return buildHotmartUrl(student, pack, metadata);

        case 'sequra':
            return buildSeQuraUrl(student, pack, metadata);

        default:
            return null;
    }
}

/**
 * Construir URL de Stripe Checkout
 * Nota: En producción, esto debería crear una Checkout Session vía API
 * y redirigir a la URL de Stripe
 */
function buildStripeUrl(student: any, pack: any, metadata: any): string {
    // Por ahora, redirigimos a una página de checkout local
    // que se encargará de crear la sesión de Stripe
    const params = new URLSearchParams({
        student_email: student.email,
        student_name: student.full_name || student.email,
        pack_id: pack.id,
        pack_name: pack.name,
        amount: pack.price.toString(),
        link_id: metadata.link_id,
    });

    return `${CONFIG.APP.URL}/checkout/stripe?${params.toString()}`;
}

/**
 * Construir URL de Hotmart
 */
function buildHotmartUrl(student: any, pack: any, metadata: any): string {
    // Obtener el ID de Hotmart del pack.gateway_ids
    const hotmartOfferId = pack.gateway_ids?.hotmart || '';

    if (!hotmartOfferId) {
        console.error('No Hotmart offer ID found for pack:', pack.id);
        return `${CONFIG.APP.URL}/error?message=hotmart_not_configured`;
    }

    const params = new URLSearchParams({
        email: student.email,
        name: student.full_name || student.email,
        src: metadata.link_id, // Para tracking
    });

    return `https://pay.hotmart.com/${hotmartOfferId}?${params.toString()}`;
}

/**
 * Construir URL de seQura
 */
function buildSeQuraUrl(student: any, pack: any, metadata: any): string {
    const merchantId = CONFIG.GATEWAYS.SEQURA.MERCHANT_ID;

    if (!merchantId) {
        console.error('seQura merchant ID not configured');
        return `${CONFIG.APP.URL}/error?message=sequra_not_configured`;
    }

    const params = new URLSearchParams({
        merchant: merchantId,
        amount: Math.round(pack.price * 100).toString(), // centavos
        email: student.email,
        reference: metadata.link_id,
    });

    return `${CONFIG.GATEWAYS.SEQURA.API_URL}/checkout?${params.toString()}`;
}
