import { NextRequest, NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
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
 * Webhook handler para Hotmart
 * Procesa eventos de compra, reembolso y cancelación
 */
export async function POST(request: NextRequest) {
    const body = await request.json();

    // Verificar token de seguridad (Hotmart envía x-hotmart-hottok)
    const headersList = await headers();
    const hotmartToken = headersList.get('x-hotmart-hottok');

    // Leer el webhook secret desde app_settings (configuración de la app)
    const { getGatewayConfig } = await import('@/lib/settings-helper');
    const hotmartConfig = await getGatewayConfig('hotmart');
    const expectedToken = hotmartConfig.webhook_secret || hotmartConfig.WEBHOOK_SECRET
        || process.env.HOTMART_WEBHOOK_SECRET; // fallback a env si no está en DB

    if (expectedToken && hotmartToken !== expectedToken) {
        console.warn(`⚠️ Hotmart webhook token inválido. Recibido: ${hotmartToken}`);
        return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    try {
        const event = body.event;
        console.log(`🔔 Hotmart Webhook recibido: ${event}`);

        switch (event) {
            case 'PURCHASE_APPROVED':
                await handlePurchaseComplete(body.data);
                break;

            case 'PURCHASE_REFUNDED':
                await handlePurchaseRefunded(body.data);
                break;

            case 'PURCHASE_CANCELLED':
            case 'SUBSCRIPTION_CANCELLATION':
                await handlePurchaseCancelled(body.data, event);
                break;

            case 'PURCHASE_CHARGEBACK':
                await handlePurchaseChargeback(body.data);
                break;

            default:
                console.log(`Evento Hotmart no manejado: ${event}`);
        }

        return NextResponse.json({ received: true });
    } catch (error) {
        console.error('Error procesando webhook de Hotmart:', error);
        return NextResponse.json(
            { error: 'Error procesando webhook' },
            { status: 500 }
        );
    }
}

/**
 * Manejar compra completada (pago único o primera cuota de Pago Inteligente)
 */
async function handlePurchaseComplete(data: any) {
    const supabase = getSupabaseAdmin();

    const transactionId = data.purchase?.transaction || data.purchase?.payment_id || '';
    const totalAmount = data.purchase?.price?.value;

    // Extract Smart Installments info (Pago Inteligente / Suscripciones)
    const recurrenceNumber = data.purchase?.recurrence_number;
    const subscriptionCode = data.subscription?.subscriber?.code || data.subscription?.plan?.id;

    console.log(`Hotmart Webhook - Purchase Approved: Tx ${transactionId}, Recurrence ${recurrenceNumber || 1}`);

    // Si es un cobro recurrente (> 1) — cuota de Pago Inteligente
    if (recurrenceNumber && recurrenceNumber > 1) {
        if (!subscriptionCode) {
            console.error('Recurrent payment received but no subscription code found in payload');
            return;
        }

        console.log(`Procesando cuota recurrente #${recurrenceNumber} para suscripción ${subscriptionCode}`);

        // Buscar la venta original por cód. de suscripción
        const { data: originalSale, error: searchError } = await supabase
            .from('sales')
            .select('*')
            .eq('gateway', 'hotmart')
            .filter('metadata->>hotmart_subscription_code', 'eq', subscriptionCode)
            .order('created_at', { ascending: true })
            .limit(1)
            .single();

        if (searchError || !originalSale) {
            console.error('No se encontró la Venta original para la suscripción recurrente:', subscriptionCode);
            return;
        }

        // Sincronizar cuotas y marcar como pagadas
        const updatedPayment = await syncPaymentToInstallments(
            supabase,
            originalSale.student_id,
            originalSale.id,
            totalAmount,
            'hotmart'
        );

        // Guardar external_id en el payment para permitir reembolso individual futuro
        if (updatedPayment?.id && transactionId) {
            await (supabase.from('payments') as any)
                .update({
                    external_id: transactionId,
                    metadata: {
                        hotmart_transaction: transactionId,
                        hotmart_recurrence_number: recurrenceNumber
                    }
                })
                .eq('id', updatedPayment.id);
        }

        console.log(`✅ Hotmart cuota #${recurrenceNumber} para venta ${originalSale.id} procesada. Comisiones via trigger.`);
        return;
    }

    // PRIMER PAGO O PAGO ÚNICO — flujo principal
    const customFields = data.purchase?.custom_fields || {};
    const linkId = data.purchase?.src || customFields.link_id || data.purchase?.sck;

    if (!linkId) {
        console.error('Link ID not found in Hotmart purchase data');
        return;
    }

    // 1. Get payment_link con todos los datos relacionados
    const { data: link, error: linkError } = await supabase
        .from('payment_links')
        .select('*, pack:packs(*), offer:pack_offers(*)')
        .eq('id', linkId)
        .single();

    if (linkError || !link) {
        console.error('Link not found in DB:', linkId, linkError);
        return;
    }

    const studentId = link.student_id;
    const packId = link.pack_id;
    const { coach_id, closer_id, setter_id, target_sale_id } = link.metadata || {};
    const packPrice = link.offer?.price || link.pack?.price || totalAmount;

    // 2. Deduplicación — buscar venta existente pendiente
    let existingSale = null;

    if (target_sale_id) {
        const { data } = await supabase
            .from('sales')
            .select('*')
            .eq('id', target_sale_id)
            .single();
        existingSale = data;
    } else {
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
            ? `${existingSale.transaction_id},${transactionId}`
            : transactionId;

        const updatePayload = {
            gateway: 'hotmart',
            transaction_id: newTransactionId,
            status: 'paid',
            metadata: {
                ...existingSale.metadata,
                purchase_id: data.purchase?.id,
                buyer_email: data.buyer?.email,
                product: data.product,
                hotmart_recurrence_number: recurrenceNumber || 1,
                hotmart_subscription_code: subscriptionCode || null
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
            amount_collected: 0,
            gateway: 'hotmart',
            transaction_id: transactionId,
            status: 'paid',
            metadata: {
                purchase_id: data.purchase?.id,
                buyer_email: data.buyer?.email,
                product: data.product,
                hotmart_recurrence_number: recurrenceNumber || 1,
                hotmart_subscription_code: subscriptionCode || null
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
        console.error('Error processing sale (insert/update):', saleError);
        return;
    }

    // Sincronizar cuotas del alumno
    const updatedPayment = await syncPaymentToInstallments(
        supabase,
        studentId,
        sale.id,
        totalAmount,
        'hotmart'
    );

    // Guardar external_id en el payment record para permitir reembolso individual
    if (updatedPayment?.id && transactionId) {
        await (supabase.from('payments') as any)
            .update({
                external_id: transactionId,
                metadata: {
                    hotmart_transaction: transactionId,
                    hotmart_purchase_id: data.purchase?.id || null
                }
            })
            .eq('id', updatedPayment.id);
    }

    // Actualizar estado del link
    await supabase
        .from('payment_links')
        .update({ status: 'paid' })
        .eq('id', linkId);

    console.log(`✅ Hotmart venta ${sale.id} procesada. Comisiones via trigger de BD.`);
}

/**
 * Manejar reembolso — el alumno ha devuelto el dinero
 */
async function handlePurchaseRefunded(data: any) {
    const supabase = getSupabaseAdmin();
    const transactionId = data.purchase?.transaction || data.purchase?.payment_id || '';

    if (!transactionId) {
        console.error('No transaction ID in Hotmart refund event');
        return;
    }

    // 1. Buscar el pago específico por external_id (trazabilidad exacta)
    const { data: payment } = await (supabase.from('payments') as any)
        .select('id, sale_id')
        .eq('external_id', transactionId)
        .single();

    if (payment) {
        // Cancelar comisiones por payment_id (preciso)
        await (supabase.from('commissions') as any)
            .update({
                status: 'incidence',
                incidence_note: 'Reembolsado por Hotmart'
            })
            .eq('payment_id', payment.id);

        // Marcar el pago como reembolsado
        await (supabase.from('payments') as any)
            .update({ status: 'refunded' })
            .eq('id', payment.id);

        // Si todos los pagos de la venta son refunded, marcar la venta
        const { data: pendingPayments } = await (supabase.from('payments') as any)
            .select('id')
            .eq('sale_id', payment.sale_id)
            .eq('status', 'paid');

        if (!pendingPayments || pendingPayments.length === 0) {
            await supabase
                .from('sales')
                .update({ status: 'refunded' })
                .eq('id', payment.sale_id);
        }

        console.log(`⚠️ Hotmart pago ${payment.id} reembolsado, comisiones marcadas como incidencia`);
        return;
    }

    // Fallback: buscar por transaction_id en sales (para ventas sin external_id en payment)
    const { data: sale, error: saleError } = await supabase
        .from('sales')
        .select('id')
        .eq('transaction_id', transactionId)
        .single();

    if (saleError || !sale) {
        console.error('Venta no encontrada para reembolso Hotmart:', transactionId);
        return;
    }

    await supabase
        .from('sales')
        .update({ status: 'refunded' })
        .eq('id', sale.id);

    await (supabase.from('commissions') as any)
        .update({
            status: 'incidence',
            incidence_note: 'Reembolsado por Hotmart'
        })
        .eq('sale_id', sale.id);

    console.log(`⚠️ Hotmart venta ${sale.id} reembolsada (fallback), comisiones marcadas como incidencia`);
}

/**
 * Manejar cancelación de compra o suscripción
 */
async function handlePurchaseCancelled(data: any, event: string) {
    const supabase = getSupabaseAdmin();
    const transactionId = data.purchase?.transaction || data.purchase?.payment_id || '';
    const subscriptionCode = data.subscription?.subscriber?.code || data.subscription?.plan?.id;

    console.log(`Hotmart ${event}: Tx ${transactionId}, Sub ${subscriptionCode}`);

    let saleId: string | null = null;

    // Buscar por subscription code si está disponible
    if (subscriptionCode) {
        const { data: sale } = await supabase
            .from('sales')
            .select('id')
            .eq('gateway', 'hotmart')
            .filter('metadata->>hotmart_subscription_code', 'eq', subscriptionCode)
            .limit(1)
            .single();
        saleId = sale?.id || null;
    }

    // Fallback: buscar por transaction_id
    if (!saleId && transactionId) {
        const { data: sale } = await supabase
            .from('sales')
            .select('id')
            .eq('transaction_id', transactionId)
            .single();
        saleId = sale?.id || null;
    }

    if (!saleId) {
        console.error(`Hotmart ${event}: No se encontró la venta para cancelar`);
        return;
    }

    // Marcar la venta como cancelada
    await supabase
        .from('sales')
        .update({ status: 'cancelled' })
        .eq('id', saleId);

    // Cancelar comisiones pendientes (no las ya pagadas)
    await (supabase.from('commissions') as any)
        .update({
            status: 'cancelled',
            incidence_note: `Cancelado via ${event}`
        })
        .eq('sale_id', saleId)
        .eq('status', 'pending');

    console.log(`⚠️ Hotmart venta ${saleId} cancelada (${event}), comisiones pendientes canceladas`);
}

/**
 * Manejar chargeback — disputa/contracargo
 */
async function handlePurchaseChargeback(data: any) {
    const supabase = getSupabaseAdmin();
    const transactionId = data.purchase?.transaction || data.purchase?.payment_id || '';

    if (!transactionId) {
        console.error('No transaction ID in Hotmart chargeback event');
        return;
    }

    // Buscar venta
    const { data: sale } = await supabase
        .from('sales')
        .select('id')
        .eq('transaction_id', transactionId)
        .single();

    if (!sale) {
        console.error('Venta no encontrada para chargeback Hotmart:', transactionId);
        return;
    }

    // Marcar como disputa
    await supabase
        .from('sales')
        .update({ status: 'refunded' })
        .eq('id', sale.id);

    await (supabase.from('commissions') as any)
        .update({
            status: 'incidence',
            incidence_note: 'Chargeback recibido de Hotmart'
        })
        .eq('sale_id', sale.id);

    console.log(`⚠️ Hotmart chargeback para venta ${sale.id}, comisiones marcadas como incidencia`);
}
