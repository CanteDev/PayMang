
require('dotenv').config();

const BASE_URL = 'http://localhost:3000';

async function testSimulation() {
    // 1. We need a valid link ID. Ideally we should create one, but for now let's ask the user or try to find one.
    // Actually, let's create a link first via API? No, API is protected.
    // Let's just use a hardcoded link ID if we have one from previous logs, or better:
    // We can't easily create a link without logging in. 
    // Let's assume the user has a link or we can fetch one from DB using service key.

    const { createClient } = require('@supabase/supabase-js');
    const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

    // Get latest pending link
    const { data: link, error } = await supabase
        .from('payment_links')
        .select('id')
        .eq('status', 'pending')
        .limit(1)
        .single();

    if (error || !link) {
        console.error('No pending links found to test simulation.');
        return;
    }

    console.log(`Testing simulation for Link ID: ${link.id}`);

    try {
        const response = await fetch(`${BASE_URL}/api/test/simulate-payment`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ linkId: link.id })
        });

        const text = await response.text();
        console.log('Response Status:', response.status);
        console.log('Response Text:', text.substring(0, 500)); // Print first 500 chars

        let result;
        try {
            result = JSON.parse(text);
            console.log('Result:', result);
        } catch (e) {
            console.error('Failed to parse JSON');
        }

        if (response.ok) {
            console.log('✅ Simulation Successful');
        } else {
            console.error('❌ Simulation Failed');
        }
    } catch (e) {
        console.error('Request failed', e);
    }
}

testSimulation();
