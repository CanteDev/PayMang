const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, serviceRoleKey);

const transactionId = 'cs_test_repro_session_123'; // Logic from reproduction script

async function checkData() {
    console.log(`Checking for transaction: ${transactionId}`);

    // Check Sale
    const { data: sale, error: saleError } = await supabase
        .from('sales')
        .select('*')
        .eq('transaction_id', transactionId)
        .maybeSingle();

    if (saleError) {
        console.error('Error fetching sale:', saleError);
        return;
    }

    if (!sale) {
        console.log('❌ Sale NOT found.');
        return;
    }

    console.log('✅ Sale found:', sale.id);

    // Check Commissions
    const { data: commissions, error: commError } = await supabase
        .from('commissions')
        .select('*')
        .eq('sale_id', sale.id);

    if (commError) {
        console.error('Error fetching commissions:', commError);
        return;
    }

    if (!commissions || commissions.length === 0) {
        console.log('❌ No commissions found for this sale.');
    } else {
        console.log(`✅ Found ${commissions.length} commissions:`);
        commissions.forEach(c => {
            console.log(` - Role: ${c.role_at_sale}, Agent: ${c.agent_id}, Amount: ${c.amount}`);
        });
    }
}

checkData();
