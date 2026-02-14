require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

async function checkHotmartSales() {
    console.log('🔍 Checking Hotmart sales...\n');

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceRoleKey) {
        console.error('❌ ERROR: Missing env vars');
        process.exit(1);
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const { data: sales, error } = await supabase
        .from('sales')
        .select('id, created_at, status, total_amount, gateway, transaction_id')
        .eq('gateway', 'hotmart')
        .order('created_at', { ascending: false })
        .limit(5);

    if (error) {
        console.error('❌ Error fetching sales:', error);
        return;
    }

    if (sales.length === 0) {
        console.log('No Hotmart sales found.');
        return;
    }

    console.log('Recent Hotmart Sales:');
    sales.forEach(sale => {
        console.log(`ID: ${sale.id}`);
        console.log(`  Transaction ID: ${sale.transaction_id}`);
        console.log(`  Status: ${sale.status}`);
        console.log(`  Date: ${sale.created_at}`);
        console.log('---');
    });
}

checkHotmartSales();
