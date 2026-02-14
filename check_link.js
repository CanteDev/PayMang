const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env' });

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkLinkAndSimulate() {
    const linkId = 'khv6umB5'; // The one from user URL

    console.log(`Checking link ${linkId}...`);

    const { data: link, error } = await supabase
        .from('payment_links')
        .select('*')
        .eq('id', linkId)
        .single();

    if (error || !link) {
        console.log(`Link ${linkId} not found. Fetching latest Hotmart link...`);
        const { data: latest } = await supabase
            .from('payment_links')
            .select('*')
            .eq('gateway', 'hotmart')
            .order('created_at', { ascending: false })
            .limit(1)
            .single();

        if (latest) {
            console.log(`Found valid link: ${latest.id}`);
            console.log(`Please update simulation script with ID: ${latest.id}`);
        } else {
            console.log('No Hotmart links found in DB.');
        }
    } else {
        console.log(`✅ Link ${linkId} exists! Ready to simulate.`);
        // Run simulation logic here directly or output confirmation
    }
}

checkLinkAndSimulate();
