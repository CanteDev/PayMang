import { NextRequest, NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { createClient } from '@supabase/supabase-js';
import { CONFIG } from '@/config/app.config';
import { calculateCommission } from '@/lib/commissions/calculator';
import Stripe from 'stripe';
import { getGatewayConfig } from '@/lib/settings-helper';
import { syncGatewayPaymentToInstallments } from '@/lib/payments-updater';

/**
 * Helper to get Service Role Client
 */
function getSupabaseAdmin() {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    if (!serviceRoleKey) throw new Error('SERVICE_ROLE_KEY missing');
    return createClient(supabaseUrl, serviceRoleKey);
}

/**
 * Webhook handler para Stripe
 * Procesa eventos de checkout.session.completed y charge.refunded
 */
export async function POST(request: NextRequest) {
    const body = await request.text();
    const headersList = await headers();
    const sig = headersList.get('stripe-signature');

    if (!sig) {
        return NextResponse.json(
            { error: 'No signature provided' },
            { status: 400 }
        );
    }

    const config = await getGatewayConfig('stripe');
    const webhookSecret = config.webhook_secret;

    let event;

    if (webhookSecret && config.secret_key) {
        try {
            const stripe = new Stripe(config.secret_key, {
                apiVersion: '2026-01-28.clover',
            });
            event = stripe.webhooks.constructEvent(body, sig, webhookSecret);
            console.log('✅ Webhook de Stripe verificado correctamente');
        } catch (err: any) {
            console.error(`⚠️ Error verificando firma de Stripe: ${err.message}`);
            return NextResponse.json({ error: `Webhook Error: ${err.message}` }, { status: 400 });
        }
    } else {
        console.warn('⚠️ Webhook Secret no configurado, saltando verificación de firma');
        event = JSON.parse(body);
    }

    try {
        switch (event.type) {
            case 'checkout.session.completed':
                await handleCheckoutCompleted(event.data.object);
                break;

            case 'invoice.paid':
                await handleInvoicePaid(event.data.object);
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
    const supabase = getSupabaseAdmin();

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
        console.error('Link no encontrado:', linkId, linkError);
        return;
    }

    // Check metadata content
    if (!link.metadata) {
        console.warn('Metadata vacía para link:', link.id);
    }

    const { coach_id, closer_id, setter_id } = link.metadata || {};
    const totalAmount = link.pack.price;

    // 2. Deduplication: Look for an existing pending sale for this student and pack
    const { data: existingSale } = await supabase
        .from('sales')
        .select('*')
        .eq('student_id', studentId)
        .eq('pack_id', packId)
        .eq('status', 'pending')
        .limit(1)
        .single();

    let sale;
    let saleError;

    const salePayload = {
        student_id: studentId,
        pack_id: packId,
        total_amount: totalAmount,
        amount_collected: totalAmount, // Stripe is full payment
        gateway: 'stripe',
        transaction_id: session.id,
        status: 'paid',
        metadata: {
            payment_intent: session.payment_intent,
            customer: session.customer,
            coach_id, // Persist metadata in sale 
            closer_id,
            setter_id,
            stripe_subscription_id: session.subscription // Clave para cuotas recurrentes
        },
    };

    if (existingSale) {
        console.log(`Found existing pending sale ${existingSale.id}. Updating it.`);
        const { data: updatedSale, error: updateError } = await supabase
            .from('sales')
            .update(salePayload as any)
            .eq('id', existingSale.id)
            .select()
            .single();
        sale = updatedSale;
        saleError = updateError;
    } else {
        console.log(`No pending sale found. Creating new sale.`);
        const { data: newSale, error: insertError } = await supabase
            .from('sales')
            .insert(salePayload as any)
            .select()
            .single();
        sale = newSale;
        saleError = insertError;
    }

    if (saleError || !sale) {
        console.error('Error processing Stripe sale (insert/update):', saleError);
        return;
    }

    // 2.5 Sincronizar cuotas del alumno (Restricted to THIS sale)
    await syncGatewayPaymentToInstallments(supabase, studentId, sale.id, totalAmount, 'stripe');

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
        milestoneNumber: 1
    });

    console.log(`✅ Venta ${sale.id} procesada y comisiones (Milestone 1) creadas`);
}

/**
 * Manejar pagos recurrentes de suscripciones (Pago Inteligente)
 */
async function handleInvoicePaid(invoice: any) {
    const supabase = getSupabaseAdmin();

    // Solo nos interesan los cobros recurrentes de suscripciones (la 1ra cuota ya entra por checkout.session.completed)
    if (invoice.billing_reason !== 'subscription_cycle') {
        console.log(`Ignorando invoice ${invoice.id} porque reason es ${invoice.billing_reason}`);
        return;
    }

    const subscriptionId = invoice.subscription;
    const amountPaidInCents = invoice.amount_paid;

    if (!subscriptionId || amountPaidInCents === 0) {
        return;
    }

    const amountPaid = amountPaidInCents / 100; // Stripe viene en céntimos

    // 1. Buscar la Venta original guiándonos por el stripe_subscription_id
    const { data: originalSale, error: searchError } = await supabase
        .from('sales')
        .select('*')
        .eq('gateway', 'stripe')
        .filter('metadata->>stripe_subscription_id', 'eq', subscriptionId)
        .order('created_at', { ascending: true })
        .limit(1)
        .single();

    if (searchError || !originalSale) {
        console.error('No se encontró la Venta original para la suscripción recurrente Stripe:', subscriptionId);
        return;
    }

    // 2. Averiguar por qué cuota (milestone) vamos analizando las comisiones previas
    const { data: prevCommissions, error: commError } = await supabase
        .from('commissions')
        .select('milestone')
        .eq('sale_id', originalSale.id)
        .order('milestone', { ascending: false })
        .limit(1);

    const nextMilestone = (prevCommissions && prevCommissions.length > 0)
        ? (prevCommissions[0].milestone + 1)
        : 2;

    // 3. Sumar al amount_collected original
    const newCollected = Number(originalSale.amount_collected || 0) + amountPaid;
    await supabase
        .from('sales')
        .update({
            amount_collected: newCollected,
            updated_at: new Date().toISOString()
        } as any)
        .eq('id', originalSale.id);

    // 4. Crear comisiones para esta nueva cuota
    await createCommissions({
        saleId: originalSale.id,
        totalAmount: amountPaid, // Solo sobre la parte pagada HOY
        coachId: originalSale.metadata?.coach_id,
        closerId: originalSale.metadata?.closer_id,
        setterId: originalSale.metadata?.setter_id,
        milestoneNumber: nextMilestone
    });

    console.log(`✅ Stripe Recurrent Invoice procesada: Añadido importe a la Venta ${originalSale.id}, creadas comisiones Milestone ${nextMilestone}`);
}

/**
 * Manejar reembolso
 */
async function handleChargeRefunded(charge: any) {
    const supabase = getSupabaseAdmin();

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
    milestoneNumber = 1
}: {
    saleId: string;
    totalAmount: number;
    coachId?: string;
    closerId?: string;
    setterId?: string;
    milestoneNumber?: number;
}) {
    const supabase = getSupabaseAdmin();
    const commissions: any[] = [];

    // Coach: 10%
    if (coachId) {
        commissions.push({
            sale_id: saleId,
            agent_id: coachId,
            role_at_sale: 'coach',
            amount: await calculateCommission(totalAmount, 'coach'),
            status: 'pending',
            milestone: milestoneNumber,
        });
    }

    // Closer: 8%
    if (closerId) {
        commissions.push({
            sale_id: saleId,
            agent_id: closerId,
            role_at_sale: 'closer',
            amount: await calculateCommission(totalAmount, 'closer'),
            status: 'pending',
            milestone: milestoneNumber,
        });
    }

    // Setter: 1% (opcional)
    if (setterId) {
        commissions.push({
            sale_id: saleId,
            agent_id: setterId,
            role_at_sale: 'setter',
            amount: await calculateCommission(totalAmount, 'setter'),
            status: 'pending',
            milestone: milestoneNumber,
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

    console.log(`✅ ${commissions.length} comisiones (milestone ${milestoneNumber}) creadas para venta ${saleId}`);
}
