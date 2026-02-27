import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import Stripe from 'stripe';
import { refundHotmartSale } from '@/lib/hotmart/checkout';

// Helper to get Stripe Client dynamically from database settings
async function getStripeClient() {
    const { getGatewayConfig } = await import('@/lib/settings-helper');
    const config = await getGatewayConfig('stripe');
    const apiKey = config.secret_key || config.SECRET_KEY;

    if (!apiKey) {
        throw new Error('Stripe API Key not configured in settings');
    }
    return new Stripe(apiKey);
}

// Helper to get Supabase Admin Client
function getSupabaseAdmin() {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    if (!serviceRoleKey) throw new Error('SERVICE_ROLE_KEY missing');
    return createClient(supabaseUrl, serviceRoleKey);
}

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { saleId } = body;

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

        if (sale.status === 'refunded') {
            return NextResponse.json({ error: 'Sale is already refunded' }, { status: 400 });
        }

        // Validate 14-day refund window
        const saleDate = new Date(sale.created_at);
        const now = new Date();
        const differenceInTime = now.getTime() - saleDate.getTime();
        const differenceInDays = differenceInTime / (1000 * 3600 * 24);

        if (differenceInDays > 14) {
            return NextResponse.json({ error: 'Refund period expired (14 days)' }, { status: 400 });
        }

        console.log(`Processing refund for sale ${saleId} (Gateway: ${sale.gateway})`);

        let refundCount = 0;
        let refundErrors: string[] = [];

        // 2. Process Refund based on Gateway
        if (sale.gateway === 'stripe') {
            const stripe = await getStripeClient();

            // Fetch all paid payments for this sale
            const { data: paidRecords } = await supabase
                .from('payments')
                .select('*')
                .eq('sale_id', saleId)
                .eq('status', 'paid');

            if (paidRecords && paidRecords.length > 0) {
                console.log(`Found ${paidRecords.length} paid installments to attempt refund`);
                for (const record of paidRecords) {
                    try {
                        let idToRefund = record.external_id;

                        // If no external_id, try to find it in record metadata
                        if (!idToRefund && record.metadata) {
                            idToRefund = record.metadata.stripe_payment_intent ||
                                record.metadata.stripe_charge_id ||
                                record.metadata.stripe_session_id ||
                                record.metadata.stripe_invoice_id;
                        }

                        if (!idToRefund) {
                            console.warn(`Payment ${record.id} has no external_id or usable metadata`);
                            continue;
                        }

                        console.log(`Refunding Stripe ID: ${idToRefund} (Payment ${record.id})`);

                        if (idToRefund.startsWith('cs_')) {
                            const session = await stripe.checkout.sessions.retrieve(idToRefund);
                            let pi = session.payment_intent as string;

                            // For some subscriptions, PI might be null on session, check invoice
                            if (!pi && session.invoice) {
                                const invoiceDetails = await stripe.invoices.retrieve(session.invoice as string) as any;
                                pi = invoiceDetails.payment_intent as string;
                            }

                            if (pi) {
                                await stripe.refunds.create({ payment_intent: pi });
                                refundCount++;
                            } else {
                                throw new Error('No se encontró Payment Intent en la sesión de Checkout');
                            }
                        } else if (idToRefund.startsWith('pi_')) {
                            await stripe.refunds.create({ payment_intent: idToRefund });
                            refundCount++;
                        } else if (idToRefund.startsWith('ch_')) {
                            await stripe.refunds.create({ charge: idToRefund });
                            refundCount++;
                        } else if (idToRefund.startsWith('in_')) {
                            // Invoices are not directly refundable, we need the PI of the invoice
                            const inv = await stripe.invoices.retrieve(idToRefund) as any;
                            if (inv.payment_intent) {
                                await stripe.refunds.create({ payment_intent: inv.payment_intent as string });
                                refundCount++;
                            } else if (inv.charge) {
                                await stripe.refunds.create({ charge: inv.charge as string });
                                refundCount++;
                            } else {
                                throw new Error('La factura no tiene un cargo asociado para reembolsar');
                            }
                        }
                    } catch (err: any) {
                        console.error(`Error refunding payment ${record.id}:`, err.message);
                        refundErrors.push(`${record.id}: ${err.message}`);
                    }
                }
            }

            // Fallback for Sale level transaction_id if nothing was refunded by individual payments
            if (refundCount === 0 && sale.transaction_id && !sale.transaction_id.startsWith('TEST_')) {
                try {
                    let tid = sale.transaction_id;
                    if (tid.startsWith('cs_')) {
                        const sess = await stripe.checkout.sessions.retrieve(tid);
                        tid = sess.payment_intent as string;
                    }
                    if (tid && (tid.startsWith('pi_') || tid.startsWith('ch_'))) {
                        await stripe.refunds.create({ payment_intent: tid.startsWith('pi_') ? tid : undefined, charge: tid.startsWith('ch_') ? tid : undefined });
                        refundCount++;
                    }
                } catch (err: any) {
                    console.error(`Fallback refund error:`, err.message);
                    refundErrors.push(`Fallback: ${err.message}`);
                }
            }

            if (refundCount === 0 && refundErrors.length > 0) {
                return NextResponse.json({
                    error: 'No se pudo procesar ningún reembolso en Stripe.',
                    details: refundErrors
                }, { status: 400 });
            }
        }
        else if (sale.gateway === 'hotmart') {
            const transactionId = sale.transaction_id;
            // Try/Catch specifically for Hotmart API to allow "Force" refund if not found in Sandbox?
            try {
                await refundHotmartSale(transactionId);
            } catch (err: any) {
                // If it's a 404 and we are in dev/sandbox, maybe we allow it?
                // But safer to just fail unless it looks like a test ID.
                // Since we added the 'HP' check above, real Hotmart errors should probably still throw.
                throw err;
            }
        } else {
            return NextResponse.json({ error: `Refund not supported for gateway: ${sale.gateway}` }, { status: 400 });
        }

        // 3. Update Database only if at least one refund succeeded
        if (refundCount > 0) {
            // Update Sale Status
            const { error: updateError } = await supabase
                .from('sales')
                .update({ status: 'refunded' })
                .eq('id', saleId);

            if (updateError) throw updateError;

            // Update Commissions Status
            await supabase
                .from('commissions')
                .update({
                    status: 'cancelled',
                    incidence_note: 'Reembolsado por Admin desde Panel de Pagos'
                })
                .eq('sale_id', saleId);

            // Update Payments Status
            await supabase
                .from('payments')
                .update({ status: 'refunded' })
                .eq('sale_id', saleId)
                .eq('status', 'paid');

            return NextResponse.json({ success: true, message: `Refund processed successfully (${refundCount} payments)` });
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
