import { NextRequest, NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import { CONFIG } from '@/config/app.config';
import { calculateCommission } from '@/lib/commissions/calculator';

/**
 * Webhook handler para Stripe
 * Procesa eventos de checkout.session.completed y charge.refunded
 */
export async function POST(request: NextRequest) {
    const body = await request.text();
    const headersList = headers();
    const sig = (await headersList).get('stripe-signature');

    if (!sig) {
        return NextResponse.json(
            { error: 'No signature provided' },
            { status: 400 }
        );
    }

    // TODO: Verificar signature de Stripe
    // const event = stripe.webhooks.constructEvent(body, sig, CONFIG.GATEWAYS.STRIPE.WEBHOOK_SECRET);

    // Por ahora, parseamos el body directamente
    const event = JSON.parse(body);

    try {
        switch (event.type) {
            case 'checkout.session.completed':
                await handleCheckoutCompleted(event.data.object);
                break;

            case 'charge.refunded':
                await handleChargeRefunded(event.data.object);
                break;

            default:
                console.log(`Evento no manejado: ${event.type}`);
        }

        return NextResponse.json({ received: true });
    } catch (error) {
        console.error('Error procesando webhook de Stripe:', error);
        return NextResponse.json(
            { error: 'Error procesando webhook' },
            { status: 500 }
        );
    }
}

/**
 * Manejar checkout completado (pago exitoso)
 */
async function handleCheckoutCompleted(session: any) {
    const supabase = await createClient();

    // Extraer metadata
    const linkId = session.metadata?.link_id;
    const studentId = session.metadata?.student_id;
    const packId = session.metadata?.pack_id;

    if (!linkId || !studentId || !packId) {
        console.error('Metadata incompleta en checkout session');
        return;
    }

    // 1. Obtener payment_link con metadatos de agentes
    const { data: link, error: linkError } = await supabase
        .from('payment_links')
        .select('*, pack:packs(*)')
        .eq('id', linkId)
        .single();

    if (linkError || !link) {
        console.error('Link no encontrado:', linkId);
        return;
    }

    const { coach_id, closer_id, setter_id } = link.metadata || {};
    const totalAmount = link.pack.price;

    // 2. Crear venta
    const { data: sale, error: saleError } = await supabase
        .from('sales')
        .insert({
            student_id: studentId,
            pack_id: packId,
            amount: totalAmount,
            gateway: 'stripe',
            transaction_id: session.id,
            status: 'paid',
            metadata: {
                payment_intent: session.payment_intent,
                customer: session.customer,
            },
        })
        .select()
        .single();

    if (saleError) {
        console.error('Error creando venta:', saleError);
        return;
    }

    // 3. Actualizar estado del link
    await supabase
        .from('payment_links')
        .update({ status: 'paid' })
        .eq('id', linkId);

    // 4. Crear comisiones automáticamente
    await createCommissions({
        saleId: sale.id,
        totalAmount,
        coachId: coach_id,
        closerId: closer_id,
        setterId: setter_id,
    });

    console.log(`✅ Venta ${sale.id} procesada y comisiones creadas`);
}

/**
 * Manejar reembolso
 */
async function handleChargeRefunded(charge: any) {
    const supabase = await createClient();

    const transactionId = charge.id;

    // 1. Buscar la venta
    const { data: sale, error: saleError } = await supabase
        .from('sales')
        .select('id')
        .eq('transaction_id', transactionId)
        .single();

    if (saleError || !sale) {
        console.error('Venta no encontrada para refund:', transactionId);
        return;
    }

    // 2. Actualizar estado de la venta
    await supabase
        .from('sales')
        .update({ status: 'refunded' })
        .eq('id', sale.id);

    // 3. Marcar comisiones como incidence
    await supabase
        .from('commissions')
        .update({ status: 'incidence' })
        .eq('sale_id', sale.id);

    console.log(`⚠️ Venta ${sale.id} reembolsada, comisiones marcadas como incidencia`);
}

/**
 * Crear comisiones para una venta
 */
async function createCommissions({
    saleId,
    totalAmount,
    coachId,
    closerId,
    setterId,
}: {
    saleId: string;
    totalAmount: number;
    coachId: string;
    closerId: string;
    setterId?: string;
}) {
    const supabase = await createClient();
    const commissions: any[] = [];

    // Coach: 10%
    if (coachId) {
        commissions.push({
            sale_id: saleId,
            agent_id: coachId,
            agent_role: 'coach',
            amount: calculateCommission(totalAmount, CONFIG.COMMISSION_RATES.COACH),
            status: 'pending',
            milestone: 1, // pago único
        });
    }

    // Closer: 8%
    if (closerId) {
        commissions.push({
            sale_id: saleId,
            agent_id: closerId,
            agent_role: 'closer',
            amount: calculateCommission(totalAmount, CONFIG.COMMISSION_RATES.CLOSER),
            status: 'pending',
            milestone: 1,
        });
    }

    // Setter: 1% (opcional)
    if (setterId) {
        commissions.push({
            sale_id: saleId,
            agent_id: setterId,
            agent_role: 'setter',
            amount: calculateCommission(totalAmount, CONFIG.COMMISSION_RATES.SETTER),
            status: 'pending',
            milestone: 1,
        });
    }

    // Insertar todas las comisiones
    const { error } = await supabase
        .from('commissions')
        .insert(commissions);

    if (error) {
        console.error('Error creando comisiones:', error);
        throw error;
    }

    console.log(`✅ ${commissions.length} comisiones creadas para venta ${saleId}`);
}
