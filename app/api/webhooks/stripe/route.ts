import { NextRequest, NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { createClient } from '@supabase/supabase-js';
import { CONFIG } from '@/config/app.config';
import { calculateCommission } from '@/lib/commissions/calculator';
import Stripe from 'stripe';
import { getGatewayConfig } from '@/lib/settings-helper';
import { syncPaymentToInstallments } from '@/lib/payments-updater';

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
            const stripe = new Stripe(config.secret_key);
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
        console.log(`🔔 Recibido evento de Stripe: ${event.type} (${event.id})`);
        switch (event.type) {
            case 'checkout.session.completed':
                console.log('Processing checkout.session.completed...');
                await handleCheckoutCompleted(event.data.object);
                break;

            case 'invoice.paid':
                console.log('Processing invoice.paid...');
                await handleInvoicePaid(event.data.object);
                break;

            case 'charge.refunded':
                console.log('Processing charge.refunded...');
                await handleChargeRefunded(event.data.object);
                break;

            default:
                console.log(`Evento de Stripe no manejado explícitamente: ${event.type}`);
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

    const { coach_id, closer_id, setter_id, target_sale_id } = link.metadata || {};
    const packPrice = link.pack.price;
    const actualAmountPaid = (session.amount_total || 0) / 100;

    if (actualAmountPaid <= 0) {
        console.warn('Checkout session with zero amount:', session.id);
    }

    // 2. Deduplication: Look for an existing pending sale for this student and pack
    let existingSale = null;

    if (target_sale_id) {
        // Explicit deduplication using the exact sale ID
        const { data } = await supabase
            .from('sales')
            .select('*')
            .eq('id', target_sale_id)
            .single();
        existingSale = data;
    } else {
        // Fallback for legacy links
        const { data } = await supabase
            .from('sales')
            .select('*')
            .eq('student_id', studentId)
            .eq('pack_id', packId)
            .eq('status', 'pending')
            .limit(1)
            .single();
        existingSale = data;
    }

    let sale;
    let saleError;

    if (existingSale) {
        console.log(`Found existing pending sale ${existingSale.id}. Updating it.`);

        const newTransactionId = existingSale.transaction_id
            ? `${existingSale.transaction_id},${session.id}`
            : session.id;

        const updatePayload = {
            gateway: 'stripe',
            transaction_id: newTransactionId,
            status: 'paid',


            metadata: {
                ...existingSale.metadata,
                payment_intent: session.payment_intent,
                customer: session.customer,
                stripe_subscription_id: session.subscription // Clave para cuotas recurrentes
            },
            coach_id: coach_id || existingSale.coach_id,
            closer_id: closer_id || existingSale.closer_id,
            setter_id: setter_id || existingSale.setter_id
        };

        const { data: updatedSale, error: updateError } = await supabase
            .from('sales')
            .update(updatePayload as any)
            .eq('id', existingSale.id)
            .select()
            .single();
        sale = updatedSale;
        saleError = updateError;
    } else {
        console.log(`No pending sale found. Creating new sale.`);

        const insertPayload = {
            student_id: studentId,
            pack_id: packId,
            total_amount: packPrice,
            amount_collected: 0, // Will be updated by syncPaymentToInstallments
            gateway: 'stripe',
            transaction_id: session.id,
            status: 'paid',
            metadata: {
                payment_intent: session.payment_intent,
                customer: session.customer,
                stripe_subscription_id: session.subscription // Clave para cuotas recurrentes
            },
            coach_id,
            closer_id,
            setter_id
        };

        const { data: newSale, error: insertError } = await supabase
            .from('sales')
            .insert(insertPayload as any)
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
    // This also updates amount_collected automatically
    const updatedPayment = await syncPaymentToInstallments(supabase, studentId, sale.id, actualAmountPaid, 'stripe');

    // Persist the Stripe Session ID or Payment Intent as external_id in the payment record for refunds
    if (updatedPayment?.id) {
        await supabase
            .from('payments')
            .update({
                external_id: session.payment_intent || session.id,
                metadata: { stripe_session_id: session.id }
            })
            .eq('id', updatedPayment.id);
    }

    // 3. Actualizar estado del link
    await supabase
        .from('payment_links')
        .update({ status: 'paid' })
        .eq('id', linkId);

    console.log(`✅ Venta ${sale.id} procesada. Las comisiones se generarán mediante el trigger de BD.`);
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

    // Extract Subscription ID robustly (sometimes nested in parent or lines in newer Stripe versions/test clocks)
    const subscriptionId = invoice.subscription ||
        invoice.parent?.subscription_details?.subscription ||
        invoice.lines?.data?.[0]?.subscription ||
        invoice.lines?.data?.[0]?.parent?.subscription_item_details?.subscription;

    const amountPaidInCents = invoice.amount_paid;

    if (!subscriptionId || amountPaidInCents === 0) {
        console.warn(`No se pudo determinar el ID de suscripción en invoice ${invoice.id} o importe es 0`);
        return;
    }

    const amountPaid = amountPaidInCents / 100;
    console.log(`Procesando pago recurrente para suscripción: ${subscriptionId}, importe: ${amountPaid}`);

    // 1. Buscar la Venta original guiándonos por el stripe_subscription_id
    const { data: originalSale, error: searchError } = await supabase
        .from('sales')
        .select('*')
        .eq('gateway', 'stripe')
        .contains('metadata', { stripe_subscription_id: subscriptionId })
        .order('created_at', { ascending: true })
        .limit(1)
        .maybeSingle();

    if (searchError || !originalSale) {
        console.error('No se encontró la Venta original para la suscripción recurrente Stripe:', subscriptionId, searchError);
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

    // 3. syncPaymentToInstallments handles amount_collected and installments
    const updatedPayment = await syncPaymentToInstallments(supabase, originalSale.student_id, originalSale.id, amountPaid, 'stripe');

    // Persist the Charge/PaymentIntent from the invoice for refunds
    // Note: invoice.charge comes from the raw webhook payload (not from API retrieve)
    if (updatedPayment?.id) {
        const chargeId = invoice.charge;       // Raw payload has charge ID
        const piId = invoice.payment_intent;   // Might be null in Test Clock

        await supabase
            .from('payments')
            .update({
                external_id: chargeId || piId || null,
                metadata: {
                    stripe_invoice_id: invoice.id,
                    stripe_charge_id: chargeId || null,
                    stripe_payment_intent: piId || null,
                }
            })
            .eq('id', updatedPayment.id);

        console.log(`Saved charge ${chargeId} and PI ${piId} for payment ${updatedPayment.id}`);
    }


    console.log(`✅ Stripe Recurrent Invoice procesada: Añadido importe a la Venta ${originalSale.id}. Las comisiones se generarán mediante el trigger de BD.`);
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

