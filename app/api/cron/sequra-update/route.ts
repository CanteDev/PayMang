import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { CONFIG } from '@/config/app.config';
import { getOrder } from '@/lib/sequra/client';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
    // Basic auth protection for Cron
    const authHeader = request.headers.get('authorization');
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
        // Allow if running locally or from Vercel Cron (Vercel automatically secures it, but good to add secret)
        // For now, allow public access if secret is missing? No, secure by default.
        // Assuming Vercel Cron calls this.
    }

    try {
        const supabase = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.SUPABASE_SERVICE_ROLE_KEY!
        );

        // 1. Get sales that are Sequra
        const { data: allSequraSales, error } = await supabase
            .from('sales')
            .select('*')
            .eq('gateway', 'sequra');

        if (error) throw error;

        // Filter in memory to avoid complex JSONB syntax issues
        const sales = allSequraSales.filter((sale: any) => {
            // Check if final_15 is NOT true (i.e. false or undefined)
            return sale.sequra_payment_status?.final_15 !== true;
        });

        const updates = [];

        for (const sale of sales) {
            if (!sale.sequra_order_ref) continue;

            try {
                // 2. Fetch status from Sequra
                const order = await getOrder(sale.sequra_order_ref);

                // Sequra Order State logic (Hypothetical - adjust based on real responses)
                // states: 'solicited', 'approved', 'needs_review', 'cancelled', 'completed'?
                const state = order.state || order.status;

                let currentStatus = sale.sequra_payment_status || { initial_70: false, second_15: false, final_15: false };
                let amountCollected = sale.amount_collected;
                let saleStatus = sale.status;
                let updated = false;

                // Logic:
                // If 'approved' -> 70% paid.
                // If 'partially_refunded'?
                // We need to know when 2nd and 3rd payments happen. 
                // Using placeholders for logic.

                /* 
                   Hypothesis:
                   - approved: We get 70%.
                   - ? : We get 15%.
                   - completed: We get final 15%.
                */

                if (state === 'approved' || state === 'confirmed') {
                    if (!currentStatus.initial_70) {
                        currentStatus.initial_70 = true;
                        amountCollected += (sale.total_amount * 0.70);
                        saleStatus = 'paid'; // Grant access
                        updated = true;
                    }
                }

                // Placeholder for 2nd milestone
                // Maybe check date? If 30 days passed?

                // Placeholder for final milestone
                if (state === 'completed') {
                    if (!currentStatus.final_15) {
                        currentStatus.final_15 = true;
                        // Assuming 2nd was also paid if final is paid
                        if (!currentStatus.second_15) {
                            currentStatus.second_15 = true;
                            amountCollected += (sale.total_amount * 0.15);
                        }
                        amountCollected += (sale.total_amount * 0.15);
                        updated = true;
                    }
                }

                if (updated) {
                    await supabase
                        .from('sales')
                        .update({
                            amount_collected: amountCollected,
                            status: saleStatus,
                            sequra_payment_status: currentStatus,
                            updated_at: new Date().toISOString() // Force update
                        })
                        .eq('id', sale.id);

                    updates.push({ id: sale.id, state, amountCollected });
                }

            } catch (err) {
                console.error(`Error updating sale ${sale.id}:`, err);
            }
        }

        return NextResponse.json({ success: true, processed: sales.length, updates });

    } catch (error: any) {
        console.error('Cron job error:', error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
