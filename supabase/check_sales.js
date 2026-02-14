require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

async function checkSales() {
    console.log('🔍 Checking recent sales...\n');

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceRoleKey) {
        console.error('❌ ERROR: Missing env vars');
        process.exit(1);
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const { data: sales, error } = await supabase
        .from('sales')
        .select('id, created_at, status, total_amount, gateway')
        .order('created_at', { ascending: false })
        .limit(10);

    if (error) {
        console.error('❌ Error fetching sales:', error);
        return;
    }

    console.log('Recent Sales:');
    const now = new Date();
    sales.forEach(sale => {
        const saleDate = new Date(sale.created_at);
        const differenceInTime = now.getTime() - saleDate.getTime();
        const differenceInDays = differenceInTime / (1000 * 3600 * 24);

        console.log(`ID: ${sale.id}`);
        console.log(`  Date: ${sale.created_at}`);
        console.log(`  Status: ${sale.status}`);
        console.log(`  Gateway: ${sale.gateway}`);
        console.log(`  Days Old: ${differenceInDays.toFixed(2)}`);
        console.log(`  Refundable (<= 14 days): ${differenceInDays <= 14}`);
        console.log('---');
    });
}

checkSales();
