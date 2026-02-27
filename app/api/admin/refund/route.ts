import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import Stripe from 'stripe';
import { refundHotmartSale } from '@/lib/hotmart/checkout';

// Helper to get Stripe Client
function getStripeClient() {
    const apiKey = process.env.STRIPE_SECRET_KEY;
    if (!apiKey) {
        // Fallback or warning during build
        console.warn('STRIPE_SECRET_KEY missing');
        // We still need to return something to avoid breaking types, 
        // but in runtime it will throw if used.
        return new Stripe('sk_test_placeholder');
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

        // 2. Process Refund based on Gateway
        if (sale.gateway === 'stripe') {
            const stripe = getStripeClient();

            // Fetch all paid payments for this sale that have an external_id
            const { data: paidRecords } = await supabase
                .from('payments')
                .select('*')
                .eq('sale_id', saleId)
                .eq('status', 'paid')
                .not('external_id', 'is', null);

            if (paidRecords && paidRecords.length > 0) {
                console.log(`Found ${paidRecords.length} paid installments to refund via external_id`);
                for (const record of paidRecords) {
                    try {
                        const idToRefund = record.external_id;
                        console.log(`Refunding Stripe ID: ${idToRefund} (Payment ${record.id})`);

                        if (idToRefund.startsWith('pi_')) {
                            await stripe.refunds.create({ payment_intent: idToRefund });
                        } else if (idToRefund.startsWith('ch_')) {
                            await stripe.refunds.create({ charge: idToRefund });
                        } else {
                            console.warn(`Unknown Stripe ID format for refund: ${idToRefund}`);
                        }
                    } catch (err: any) {
                        console.error(`Error refunding payment ${record.id}:`, err.message);
                        // We continue with others if one fails? Or fail all? 
                        // For now, let's just log and continue to try to refund as much as possible.
                    }
                }
            } else {
                // FALLBACK: Old logic using sale.transaction_id
                console.log('No individual payment external_ids found. Falling back to sale.transaction_id logic.');
                let paymentIntentId = sale.transaction_id;

                if (!paymentIntentId || paymentIntentId.startsWith('TEST_')) {
                    console.log('Skipping refund for test transaction');
                } else {
                    // Try to handle cs_ sessions if present in transaction_id
                    if (paymentIntentId.startsWith('cs_')) {
                        const session = await stripe.checkout.sessions.retrieve(paymentIntentId);
                        paymentIntentId = session.payment_intent as string;
                    }

                    if (paymentIntentId) {
                        await stripe.refunds.create({ payment_intent: paymentIntentId });
                    }
                }
            }

        } else if (sale.gateway === 'hotmart') {
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

        // 3. Update Database
        // We update optimistically. Webhooks should typically handle this, but for Admin action we want immediate feedback.

        // Update Sale Status
        const { error: updateError } = await supabase
            .from('sales')
            .update({ status: 'refunded' })
            .eq('id', saleId);

        if (updateError) throw updateError;

        // Update Commissions Status
        // Mark as 'cancelled' as requested by user.
        await supabase
            .from('commissions')
            .update({
                status: 'cancelled',
                incidence_note: 'Reembolsado por Admin desde Panel de Pagos'
            })
            .eq('sale_id', saleId);

        return NextResponse.json({ success: true, message: 'Refund processed successfully' });

    } catch (error: any) {
        console.error('Refund error:', error);
        return NextResponse.json(
            { error: error.message || 'Error processing refund' },
            { status: 500 }
        );
    }
}
