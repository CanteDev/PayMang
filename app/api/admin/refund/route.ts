import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import Stripe from 'stripe';
import { refundHotmartSale } from '@/lib/hotmart/checkout';

// Helper to get Stripe Client dynamically from database settings
async function getStripeClient() {
    const { getGatewayConfig } = await import('@/lib/settings-helper');
    const config = await getGatewayConfig('stripe');
    const apiKey = config.secret_key || config.SECRET_KEY;
    if (!apiKey) throw new Error('Stripe API Key not configured in settings');
    return new Stripe(apiKey);
}

// Helper to get Supabase Admin Client
function getSupabaseAdmin() {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    if (!serviceRoleKey) throw new Error('SERVICE_ROLE_KEY missing');
    return createClient(supabaseUrl, serviceRoleKey);
}

/**
 * Attempts to refund a single Stripe charge/PI/session/invoice record.
 * Returns true if refund succeeded, throws on error.
 */
async function refundStripeRecord(stripe: Stripe, record: any): Promise<boolean> {
    let idToRefund = record.external_id;

    // Discover Stripe ID from metadata if no external_id
    if (!idToRefund && record.metadata) {
        idToRefund =
            record.metadata.stripe_charge_id ||
            record.metadata.stripe_payment_intent ||
            record.metadata.stripe_session_id ||
            record.metadata.stripe_invoice_id;
    }

    if (!idToRefund) {
        console.warn(`Payment ${record.id} has no external_id or usable metadata — skipping`);
        return false;
    }

    console.log(`Refunding Stripe ID: ${idToRefund} (Payment ${record.id})`);

    if (idToRefund.startsWith('cs_')) {
        const session = await stripe.checkout.sessions.retrieve(idToRefund);
        let pi = session.payment_intent as string;

        if (!pi && session.invoice) {
            const inv = await stripe.invoices.retrieve(session.invoice as string) as any;
            pi = inv.payment_intent as string;
        }

        if (pi) {
            await stripe.refunds.create({ payment_intent: pi });
            return true;
        }
        throw new Error('No se encontró Payment Intent en la sesión de Checkout');
    }

    if (idToRefund.startsWith('pi_')) {
        await stripe.refunds.create({ payment_intent: idToRefund });
        return true;
    }

    if (idToRefund.startsWith('ch_')) {
        await stripe.refunds.create({ charge: idToRefund });
        return true;
    }

    if (idToRefund.startsWith('in_')) {
        const inv = await stripe.invoices.retrieve(idToRefund) as any;
        // Direct fields (works for real payments)
        if (inv.payment_intent) {
            await stripe.refunds.create({ payment_intent: inv.payment_intent as string });
            return true;
        }
        if (inv.charge) {
            await stripe.refunds.create({ charge: inv.charge as string });
            return true;
        }
        // Fallback for Test Clock invoices: use Stripe's server-side invoice filter
        // charges.list supports { invoice: 'in_...' } as a direct API parameter
        const chargesForInvoice = await (stripe.charges as any).list({
            limit: 10,
            invoice: idToRefund
        });
        const matchingCharge = (chargesForInvoice.data as any[]).find(
            (ch: any) => ch.status === 'succeeded' && !ch.refunded
        );
        if (matchingCharge) {
            await stripe.refunds.create({ charge: matchingCharge.id });
            return true;
        }
        throw new Error('La factura no tiene un cargo reembolsable asociado');
    }

    console.warn(`Unknown Stripe ID format: ${idToRefund}`);
    return false;
}

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { saleId, paymentId } = body;

        if (!saleId) {
            return NextResponse.json({ error: 'Sale ID is required' }, { status: 400 });
        }

        const supabase = getSupabaseAdmin();

        // 1. Fetch sale details
        const { data: sale, error: saleError } = await supabase
            .from('sales')
            .select('*')
            .eq('id', saleId)
            .single();

        if (saleError || !sale) {
            return NextResponse.json({ error: 'Sale not found' }, { status: 404 });
        }

        const isIndividual = !!paymentId;

        // For individual payment refunds: check if the specific payment is already refunded
        // For full-sale refunds: check if the whole sale is already refunded
        if (isIndividual) {
            const { data: paymentCheck } = await supabase
                .from('payments')
                .select('status')
                .eq('id', paymentId)
                .single();

            if (paymentCheck?.status === 'refunded') {
                return NextResponse.json({ error: 'Este pago ya ha sido reembolsado' }, { status: 400 });
            }
        } else {
            if (sale.status === 'refunded') {
                return NextResponse.json({ error: 'La venta ya está reembolsada' }, { status: 400 });
            }
        }

        // Validate 14-day refund window
        const saleDate = new Date(sale.created_at);
        const now = new Date();
        const differenceInDays = (now.getTime() - saleDate.getTime()) / (1000 * 3600 * 24);

        if (differenceInDays > 14) {
            return NextResponse.json({ error: 'Refund period expired (14 days)' }, { status: 400 });
        }

        console.log(`Processing ${isIndividual ? 'individual payment' : 'full sale'} refund (Gateway: ${sale.gateway})`);

        let refundCount = 0;
        let refundErrors: string[] = [];
        const refundedPaymentIds: string[] = [];

        // 2. Stripe refund flow
        if (sale.gateway === 'stripe') {
            const stripe = await getStripeClient();

            // Determine which payments to process
            let paymentsQuery = supabase
                .from('payments')
                .select('*')
                .eq('sale_id', saleId)
                .eq('status', 'paid');

            if (isIndividual) {
                // Only the specific payment
                paymentsQuery = paymentsQuery.eq('id', paymentId);
            }

            const { data: paidRecords } = await paymentsQuery;

            if (paidRecords && paidRecords.length > 0) {
                console.log(`Found ${paidRecords.length} paid installment(s) to attempt refund`);

                for (const record of paidRecords) {
                    try {
                        const success = await refundStripeRecord(stripe, record);
                        if (success) {
                            refundCount++;
                            refundedPaymentIds.push(record.id);
                        }
                    } catch (err: any) {
                        console.error(`Error refunding payment ${record.id}:`, err.message);
                        refundErrors.push(`${record.id}: ${err.message}`);
                    }
                }
            }

            // Fallback for full-sale mode: use Stripe customer ID to find charges by date
            if (!isIndividual && refundCount === 0) {
                const stripeCustomerId = sale.metadata?.customer;

                if (stripeCustomerId) {
                    console.log(`Customer-level fallback for customer: ${stripeCustomerId}`);
                    try {
                        const saleCreatedTimestamp = Math.floor(new Date(sale.created_at).getTime() / 1000);
                        const charges = await stripe.charges.list({
                            customer: stripeCustomerId,
                            limit: 20,
                            created: { gte: saleCreatedTimestamp },
                        });

                        const refundableCharges = charges.data.filter(
                            ch => ch.status === 'succeeded' && !ch.refunded
                        );

                        for (const charge of refundableCharges) {
                            try {
                                await stripe.refunds.create({ charge: charge.id });
                                refundCount++;
                                console.log(`Refunded charge via fallback: ${charge.id}`);
                            } catch (err: any) {
                                if (!err.message.includes('already been refunded')) {
                                    refundErrors.push(`charge_${charge.id}: ${err.message}`);
                                }
                            }
                        }
                    } catch (err: any) {
                        console.error(`Customer fallback refund error:`, err.message);
                        refundErrors.push(`CustomerFallback: ${err.message}`);
                    }
                }
            }

            if (refundCount === 0 && refundErrors.length > 0) {
                return NextResponse.json({
                    error: 'No se pudo procesar ningún reembolso en Stripe.',
                    details: refundErrors
                }, { status: 400 });
            }

        } else if (sale.gateway === 'hotmart') {
            if (isIndividual) {
                return NextResponse.json({ error: 'El reembolso individual no está disponible para Hotmart' }, { status: 400 });
            }
            await refundHotmartSale(sale.transaction_id);
            refundCount = 1;
        } else {
            return NextResponse.json({ error: `Refund not supported for gateway: ${sale.gateway}` }, { status: 400 });
        }

        // 3. Update database only if at least one refund succeeded
        if (refundCount > 0) {
            if (isIndividual) {
                // Individual mode: only mark the specific payment as refunded
                await supabase
                    .from('payments')
                    .update({ status: 'refunded' })
                    .eq('id', paymentId);

                // Update sale amount_collected (reduce by refunded amount)
                const { data: refundedPayment } = await supabase
                    .from('payments')
                    .select('amount')
                    .eq('id', paymentId)
                    .single();

                if (refundedPayment) {
                    const newCollected = Math.max(0, Number(sale.amount_collected || 0) - Number(refundedPayment.amount));
                    await supabase
                        .from('sales')
                        .update({ amount_collected: newCollected })
                        .eq('id', saleId);
                }

                return NextResponse.json({ success: true, message: `Pago reembolsado correctamente` });
            } else {
                // Full sale mode: mark sale + all paid payments as refunded
                await supabase
                    .from('sales')
                    .update({ status: 'refunded' })
                    .eq('id', saleId);

                await supabase
                    .from('commissions')
                    .update({
                        status: 'cancelled',
                        incidence_note: 'Reembolsado por Admin desde Panel de Pagos'
                    })
                    .eq('sale_id', saleId);

                await supabase
                    .from('payments')
                    .update({ status: 'refunded' })
                    .eq('sale_id', saleId)
                    .eq('status', 'paid');

                return NextResponse.json({ success: true, message: `Venta reembolsada correctamente (${refundCount} pagos)` });
            }
        } else {
            return NextResponse.json({
                error: 'No se pudo procesar el reembolso en Stripe.',
                details: refundErrors.length > 0 ? refundErrors : ['No se encontraron IDs de transacción válidos']
            }, { status: 400 });
        }

    } catch (error: any) {
        console.error('Refund error:', error);
        return NextResponse.json(
            { error: error.message || 'Error processing refund' },
            { status: 500 }
        );
    }
}
