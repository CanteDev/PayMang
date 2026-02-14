const { createClient } = require('@supabase/supabase-js');
// Load env vars
require('dotenv').config({ path: '.env' });

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function verifyHotmartSale() {
    console.log('Verifying Hotmart Sale...');

    // Get latest sale
    const { data: sales, error: saleError } = await supabase
        .from('sales')
        .select(`
        *,
        commissions (*)
    `)
        .eq('gateway', 'hotmart')
        .order('created_at', { ascending: false })
        .limit(1);

    if (saleError) {
        console.error('Error fetching sale:', saleError);
        return;
    }

    if (!sales || sales.length === 0) {
        console.log('No Hotmart sales found.');
        return;
    }

    const sale = sales[0];
    console.log('\n✅ Latest Hotmart Sale Found:');
    console.log(`ID: ${sale.id}`);
    console.log(`Amount: ${sale.total_amount}`);
    console.log(`Status: ${sale.status}`);
    console.log(`Transaction ID: ${sale.transaction_id}`);

    console.log('\n💰 Commissions Created:');
    if (sale.commissions && sale.commissions.length > 0) {
        sale.commissions.forEach(comm => {
            console.log(`- Agent: ${comm.agent_id} | Role: ${comm.role_at_sale} | Amount: ${comm.amount} | Status: ${comm.status}`);
        });
    } else {
        console.log('❌ No commissions found for this sale!');
    }
}

verifyHotmartSale();
