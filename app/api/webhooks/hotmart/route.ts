import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { CONFIG } from '@/config/app.config';
import { calculateCommission } from '@/lib/commissions/calculator';

/**
 * Webhook handler para Hotmart
 * Procesa eventos de compra y reembolso
 */
export async function POST(request: NextRequest) {
    const body = await request.json();

    // Verificar token de seguridad (Hotmart usa token, no signature)
    const hotmartToken = request.headers.get('x-hotmart-hottok');

    if (hotmartToken !== CONFIG.GATEWAYS.HOTMART.WEBHOOK_SECRET) {
        return NextResponse.json(
            { error: 'Invalid token' },
            { status: 401 }
        );
    }

    try {
        const event = body.event;

        switch (event) {
            case 'PURCHASE_COMPLETE':
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
    const supabase = await createClient();

    // Hotmart envía el link_id en custom_field o src
    const linkId = data.purchase?.src || data.purchase?.custom_field;
    const transactionId = data.purchase?.transaction;
    const totalAmount = data.purchase?.price?.value;

    if (!linkId) {
        console.error('Link ID no encontrado en purchase data');
        return;
    }

    // 1. Obtener payment_link
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

    // 2. Crear venta
    const { data: sale, error: saleError } = await supabase
        .from('sales')
        .insert({
            student_id: link.student_id,
            pack_id: link.pack_id,
            amount: totalAmount,
            gateway: 'hotmart',
            transaction_id: transactionId,
            status: 'paid',
            metadata: {
                buyer_email: data.buyer?.email,
                product: data.product,
            },
        })
        .select()
        .single();

    if (saleError) {
        console.error('Error creando venta:', saleError);
        return;
    }

    // 3. Actualizar link
    await supabase
        .from('payment_links')
        .update({ status: 'paid' })
        .eq('id', linkId);

    // 4. Crear comisiones
    await createCommissions({
        saleId: sale.id,
        totalAmount,
        coachId: coach_id,
        closerId: closer_id,
        setterId: setter_id,
    });

    console.log(`✅ Venta Hotmart ${sale.id} procesada`);
}

/**
 * Manejar reembolso
 */
async function handlePurchaseRefunded(data: any) {
    const supabase = await createClient();
    const transactionId = data.purchase?.transaction;

    const { data: sale } = await supabase
        .from('sales')
        .select('id')
        .eq('transaction_id', transactionId)
        .single();

    if (!sale) {
        console.error('Venta no encontrada para refund:', transactionId);
        return;
    }

    await supabase
        .from('sales')
        .update({ status: 'refunded' })
        .eq('id', sale.id);

    await supabase
        .from('commissions')
        .update({ status: 'incidence' })
        .eq('sale_id', sale.id);

    console.log(`⚠️ Venta Hotmart ${sale.id} reembolsada`);
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
}: {
    saleId: string;
    totalAmount: number;
    coachId: string;
    closerId: string;
    setterId?: string;
}) {
    const supabase = await createClient();
    const commissions: any[] = [];

    if (coachId) {
        commissions.push({
            sale_id: saleId,
            agent_id: coachId,
            agent_role: 'coach',
            amount: calculateCommission(totalAmount, CONFIG.COMMISSION_RATES.COACH),
            status: 'pending',
            milestone: 1,
        });
    }

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

    const { error } = await supabase
        .from('commissions')
        .insert(commissions);

    if (error) {
        console.error('Error creando comisiones:', error);
        throw error;
    }

    console.log(`✅ ${commissions.length} comisiones creadas para venta ${saleId}`);
}
