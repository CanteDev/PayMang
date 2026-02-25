import { NextRequest, NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { CONFIG } from '@/config/app.config';
import { calculateCommission } from '@/lib/commissions/calculator';
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
 * Webhook handler para Hotmart
 * Procesa eventos de compra y reembolso
 */
export async function POST(request: NextRequest) {
    const body = await request.json();

    // Verificar token de seguridad (Hotmart usa token, no signature)
    const headersList = await headers();
    const hotmartToken = headersList.get('x-hotmart-hottok');

    // TODO: Verify Hotmart signature properly
    // For development, we skip verification
    // if (hotmartToken !== CONFIG.GATEWAYS.HOTMART.WEBHOOK_SECRET) {
    //     return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    // }

    try {
        const event = body.event;

        switch (event) {
            case 'PURCHASE_APPROVED':
                await handlePurchaseComplete(body.data);
                break;

            case 'PURCHASE_REFUNDED':
                await handlePurchaseRefunded(body.data);
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
 * Manejar compra completada
 */
async function handlePurchaseComplete(data: any) {
    const supabase = getSupabaseAdmin();

    const transactionId = data.purchase?.transaction || data.purchase?.payment_id || '';
    const totalAmount = data.purchase?.price?.value;

    // Extract Smart Installments info (Pago Inteligente / Suscripciones)
    const recurrenceNumber = data.purchase?.recurrence_number;
    const subscriptionCode = data.subscription?.subscriber?.code || data.subscription?.plan?.id;

    console.log(`Hotmart Webhook - Purchase Approved: Tx ${transactionId}, Recurrence ${recurrenceNumber || 1}`);

    // Si es un cobro recurrente (> 1)
    if (recurrenceNumber && recurrenceNumber > 1) {
        if (!subscriptionCode) {
            console.error('Recurrent payment received but no subscription code found in payload');
            return;
        }

        console.log(`Procesando cuota recurrente #${recurrenceNumber} para suscripción ${subscriptionCode}`);

        // Buscar la venta original por cód. de suscripción o transacción
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
            // Si quieres que quede registrada igualmente, podrías crearla pero romperías la trazabilidad.
            // Lo más sano es ignorarla o guardarla en una tabla de incidencias, por ahora hacemos return.
            return;
        }

        // Sumar al amount_collected
        const newCollected = Number(originalSale.amount_collected || 0) + Number(totalAmount || 0);
        await supabase
            .from('sales')
            .update({
                amount_collected: newCollected,
                updated_at: new Date().toISOString()
            } as any)
            .eq('id', originalSale.id);

        // 3.5 Sincronizar cuotas
        await syncGatewayPaymentToInstallments(supabase, originalSale.student_id, totalAmount, 'hotmart');

        // 4. Crear comisiones para esta cuota / milestone)
        await createCommissions({
            saleId: originalSale.id,
            totalAmount: totalAmount, // Solo la cantidad de ESTA cuota
            coachId: originalSale.metadata?.coach_id,
            closerId: originalSale.metadata?.closer_id,
            setterId: originalSale.metadata?.setter_id,
            milestoneNumber: recurrenceNumber
        });

        console.log(`✅ Hotmart installment #${recurrenceNumber} for sale ${originalSale.id} processed appended to original.`);
        return;
    }

    // SI ES EL PRIMER PAGO (O UN PAGO ÚNICO SIN RECURRENCIA) Sigamos el flujo original:
    const customFields = data.purchase?.custom_fields || {};
    const linkId = data.purchase?.src || customFields.link_id || data.purchase?.sck;

    if (!linkId) {
        console.error('Link ID not found in Hotmart purchase data');
        return;
    }

    // 1. Get payment_link with all related data
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
    const offerId = link.pack_offer_id;

    const { coach_id, closer_id, setter_id } = link.metadata || {};
    const packPrice = link.offer?.price || link.pack?.price || totalAmount;

    // 2. Create sale, inyectando meta de suscripción si la hay
    const { data: sale, error: saleError } = await supabase
        .from('sales')
        .insert({
            student_id: studentId,
            pack_id: packId,
            total_amount: packPrice, // Lo que cuesta en total el pack
            amount_collected: totalAmount, // Lo que ha pagado HOY
            gateway: 'hotmart',
            transaction_id: transactionId,
            status: 'paid',
            metadata: {
                purchase_id: data.purchase?.id,
                buyer_email: data.buyer?.email,
                product: data.product,
                coach_id: coach_id,
                closer_id: closer_id,
                setter_id: setter_id,
                link_id: linkId,
                pack_offer_id: offerId,
                hotmart_subscription_code: subscriptionCode, // CLAVE PARA FUTURAS CUOTAS
                hotmart_recurrence_number: recurrenceNumber || 1
            },
        } as any)
        .select()
        .single();

    if (saleError) {
        console.error('Error creating sale:', saleError);
        return;
    }

    // 2.5 Sincronizar pago con las cuotas
    await syncGatewayPaymentToInstallments(supabase, studentId, totalAmount, 'hotmart');

    // 3. Update link status
    await supabase
        .from('payment_links')
        .update({ status: 'paid' })
        .eq('id', linkId);

    // 4. Create commissions (Milestone 1 by default now)
    await createCommissions({
        saleId: sale.id,
        totalAmount: totalAmount, // Comisionamos sobre lo pagado HOY
        coachId: coach_id,
        closerId: closer_id,
        setterId: setter_id,
        milestoneNumber: 1
    });

    console.log(`✅ Hotmart FIRST sale ${sale.id} processed and initial commissions created`);
}

/**
 * Manejar reembolso
 */
async function handlePurchaseRefunded(data: any) {
    const supabase = getSupabaseAdmin();
    const transactionId = data.purchase?.transaction || data.purchase?.payment_id || '';

    if (!transactionId) {
        console.error('No transaction ID in Hotmart refund event');
        return;
    }

    // 1. Find the sale
    const { data: sale, error: saleError } = await supabase
        .from('sales')
        .select('id')
        .eq('transaction_id', transactionId)
        .single();

    if (saleError || !sale) {
        console.error('Sale not found for Hotmart refund:', transactionId);
        return;
    }

    // 2. Update sale status
    await supabase
        .from('sales')
        .update({ status: 'refunded' })
        .eq('id', sale.id);

    // 3. Mark commissions as incidence
    await supabase
        .from('commissions')
        .update({ status: 'incidence' })
        .eq('sale_id', sale.id);

    console.log(`⚠️ Hotmart sale ${sale.id} refunded, commissions marked as incidence`);
}

/**
 * Función reutilizada de Stripe webhook
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

    // Setter: 1% (optional)
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

    const { error } = await supabase
        .from('commissions')
        .insert(commissions);

    if (error) {
        console.error('Error creando comisiones:', error);
        throw error;
    }

    console.log(`✅ ${commissions.length} comisiones (milestone ${milestoneNumber}) creadas para venta ${saleId}`);
}
