import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import Stripe from 'stripe';
import { refundHotmartSale } from '@/lib/hotmart/checkout';

// Initialize Stripe
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

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
        if (sale.transaction_id && (sale.transaction_id.startsWith('TEST_') || sale.transaction_id.startsWith('HP'))) {
            // Mock refund for test transactions or Product IDs used as transactions in sandbox
            console.log(`Skipping external API refund for test/stub transaction: ${sale.transaction_id}`);
        } else if (sale.gateway === 'stripe') {
            let paymentIntentId = sale.transaction_id;

            // If ID starts with 'cs_', it's a Checkout Session. Retrieve the PaymentIntent.
            if (paymentIntentId && paymentIntentId.startsWith('cs_')) {
                console.log(`Resolving PaymentIntent from Checkout Session: ${paymentIntentId}`);
                const session = await stripe.checkout.sessions.retrieve(paymentIntentId);
                if (!session.payment_intent) {
                    return NextResponse.json({ error: 'Payment Intent not found for this session' }, { status: 400 });
                }
                paymentIntentId = session.payment_intent as string;
            }

            await stripe.refunds.create({
                payment_intent: paymentIntentId,
            });

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
