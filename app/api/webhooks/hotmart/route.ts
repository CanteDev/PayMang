import { NextRequest, NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { createClient } from '@supabase/supabase-js';
import { CONFIG } from '@/config/app.config';
import { calculateCommission } from '@/lib/commissions/calculator';

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
/**
 * Manejar compra completada
 */
async function handlePurchaseComplete(data: any) {
    const supabase = getSupabaseAdmin();

    // Extract link_id from Hotmart payload (src or custom_fields)
    const customFields = data.purchase?.custom_fields || {};
    const linkId = data.purchase?.src || customFields.link_id || data.purchase?.sck;

    const transactionId = data.purchase?.transaction || data.purchase?.payment_id || '';
    const totalAmount = data.purchase?.price?.value;

    if (!linkId) {
        console.error('Link ID not found in Hotmart purchase data');
        return;
    }

    // 1. Get payment_link with all related data
    const { data: link, error: linkError } = await supabase
        .from('payment_links')
        .select('*, pack:packs(*)')
        .eq('id', linkId)
        .single();

    if (linkError || !link) {
        console.error('Link not found in DB:', linkId, linkError);
        return;
    }

    // Retrieve data from the link record, not from Hotmart payload
    const studentId = link.student_id;
    const packId = link.pack_id;
    // Metadata in link contains agent IDs
    const { coach_id, closer_id, setter_id } = link.metadata || {};

    const packPrice = link.pack.price || totalAmount;

    // 2. Create sale
    const { data: sale, error: saleError } = await supabase
        .from('sales')
        .insert({
            student_id: studentId,
            pack_id: packId,
            total_amount: packPrice,
            amount_collected: packPrice,
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
                link_id: linkId // Keep track of origin link
            },
        })
        .select()
        .single();

    if (saleError) {
        console.error('Error creating sale:', saleError);
        return;
    }

    // 3. Update link status
    await supabase
        .from('payment_links')
        .update({ status: 'paid' })
        .eq('id', linkId);

    // 4. Create commissions
    await createCommissions({
        saleId: sale.id,
        totalAmount: packPrice,
        coachId: coach_id,
        closerId: closer_id,
        setterId: setter_id,
    });

    console.log(`✅ Hotmart sale ${sale.id} processed and commissions created`);
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
}: {
    saleId: string;
    totalAmount: number;
    coachId: string;
    closerId: string;
    setterId?: string;
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
            milestone: 1,
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
            milestone: 1,
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
