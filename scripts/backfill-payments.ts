import { createClient } from '@supabase/supabase-js';
import { syncGatewayPaymentToInstallments } from '../lib/payments-updater';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });
dotenv.config();

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL as string, process.env.SUPABASE_SERVICE_ROLE_KEY as string);

async function run() {
    console.log("Fetching all sales that have amount_collected > 0...");
    const { data: sales, error } = await supabase
        .from('sales')
        .select('id, student_id, amount_collected, gateway')
        .gt('amount_collected', 0);

    if (error || !sales) {
        console.error("Error fetching sales:", error);
        return;
    }

    console.log(`Found ${sales.length} sales. Syncing...`);
    for (const sale of sales) {
        if (!sale.student_id) continue;
        console.log(`Syncing sale ${sale.id} for student ${sale.student_id} (${sale.amount_collected} via ${sale.gateway})`);

        // Let's reset their pending status via the sync function
        // Note: this function naturally skips already-paid installments, 
        // but if they were manually paid vs webhook paid, it's fine.
        await syncGatewayPaymentToInstallments(supabase, sale.student_id, sale.id, sale.amount_collected, sale.gateway);
    }
    console.log("Done backfilling.");
}

run();
