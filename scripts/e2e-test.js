
const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
// const fetch = require('node-fetch'); // Native fetch in Node 18+

dotenv.config({ path: '.env' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
    console.error('❌ Missing Env Vars');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey);

async function runE2ETest() {
    console.log('🚀 Starting "Headless" E2E Test...');

    // 1. Setup Data
    const suffix = Math.floor(Math.random() * 10000);
    const studentEmail = `student_test_${suffix}@example.com`;
    const coachEmail = 'coach@test.com'; // Assumed existing
    const closerEmail = 'closer@test.com'; // Assumed existing

    console.log(`\n1️⃣ Creating Test Data for Student: ${studentEmail}`);

    // Get Agent IDs
    const { data: coach } = await supabase.from('profiles').select('id').eq('email', coachEmail).single();
    const { data: closer } = await supabase.from('profiles').select('id').eq('email', closerEmail).single();

    if (!coach || !closer) {
        console.error('❌ Agents not found. Please run seed or manual setup.');
        return;
    }

    // Create Student
    const { data: student, error: studentError } = await supabase.from('students').insert({
        email: studentEmail,
        full_name: `Test Student ${suffix}`,
        status: 'active',
        assigned_coach_id: coach.id,
        closer_id: closer.id
    }).select().single();

    if (studentError) {
        console.error('❌ Student Creation Failed:', studentError);
        return;
    }
    console.log('✅ Student Created:', student.id);

    // Get Pack
    let { data: pack } = await supabase.from('packs').select('*').limit(1).single();
    if (!pack) {
        // Create Mock Pack
        const { data: newPack } = await supabase.from('packs').insert({
            name: 'Pack E2E',
            price: 1000,
            is_active: true
        }).select().single();
        pack = newPack;
    }
    console.log('✅ Pack Used:', pack.name);

    // Create Payment Link
    const linkId = `e2e_link_${suffix}`; // Short code
    const { error: linkError } = await supabase.from('payment_links').insert({
        id: linkId, // Manual ID for testing
        student_id: student.id,
        pack_id: pack.id,
        gateway: 'hotmart',
        created_by: closer.id,
        metadata: {
            closer_id: closer.id,
            coach_id: coach.id
        },
        status: 'pending'
    });

    if (linkError) {
        console.error('❌ Link Creation Failed:', linkError);
        return;
    }
    console.log('✅ Payment Link Created:', linkId);

    // 2. Simulate Webhook (Purchase)
    console.log('\n2️⃣ Simulating Hotmart Webhook...');

    const webhookPayload = {
        event: "PURCHASE_COMPLETE",
        data: {
            product: { id: 12345, name: pack.name },
            purchase: {
                transaction: `HP-${suffix}`,
                price: { value: pack.price, currency_code: "EUR" },
                status: "APPROVED",
                src: linkId, // Crucial connection
                custom_fields: { link_id: linkId }
            },
            buyer: { email: studentEmail, name: "Test Buyer" }
        }
    };

    // Need to hit the local Next.js server
    // Assuming running on localhost:3000
    try {
        const response = await fetch('http://localhost:3000/api/webhooks/hotmart', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-hotmart-hottok': process.env.HOTMART_WEBHOOK_SECRET || 'your-webhook-secret'
            },
            body: JSON.stringify(webhookPayload)
        });

        const text = await response.text();
        console.log(`   Webhook Response: ${response.status} ${text}`);

        if (response.status >= 400) throw new Error('Webhook failed');

    } catch (e) {
        console.error('❌ Webhook Request Failed:', e.message);
        console.log('   Ensure npm run dev is running!');
        return;
    }

    // 3. Verify Results
    console.log('\n3️⃣ Verifying Database State...');

    // Wait a moment for async processing if any (though usually sync in Next chain)
    await new Promise(r => setTimeout(r, 2000));

    // Check Sale
    const { data: sale } = await supabase.from('sales')
        .select('*')
        .eq('transaction_id', `HP-${suffix}`)
        .single();

    if (!sale) {
        console.error('❌ Sale NOT found!');
    } else {
        console.log('✅ Sale Created:', sale.id);
        console.log('   Amount:', sale.total_amount);
    }

    // Check Commissions
    const { data: commissions } = await supabase.from('commissions')
        .select('*, agent:profiles(full_name, role)')
        .eq('sale_id', sale?.id);

    if (commissions && commissions.length > 0) {
        console.log(`✅ Commissions Created: ${commissions.length}`);
        commissions.forEach(c => {
            console.log(`   - [${c.status}] ${c.agent.role} (${c.agent.full_name}): ${c.amount}€`);
        });
    } else {
        console.error('❌ No commissions created!');
    }

    // 4. Simulate State Transitions (Direct DB)
    if (commissions.length > 0) {
        const comm = commissions[0];
        console.log(`\n4️⃣ Simulating Lifecycle for Commission ${comm.id}...`);

        // Validate
        await supabase.from('commissions').update({ status: 'validated', validated_at: new Date().toISOString() }).eq('id', comm.id);
        console.log('   ➡️  Marked as VALIDATED');

        // Pay
        await supabase.from('commissions').update({ status: 'paid', paid_at: new Date().toISOString() }).eq('id', comm.id);
        console.log('   ➡️  Marked as PAID');

        // Report Incidence (on another comm)
        if (commissions.length > 1) {
            const comm2 = commissions[1];
            await supabase.from('commissions').update({ status: 'incidence', incidence_note: "Test Incidence" }).eq('id', comm2.id);
            console.log(`   ➡️  Marked Commission ${comm2.id} as INCIDENCE`);

            // Resolve
            await supabase.from('commissions').update({ status: 'validated', incidence_note: "Resolved" }).eq('id', comm2.id);
            console.log('   ➡️  Resolved Incidence (Back to VALIDATED)');
        }
    }

    console.log('\n✅ E2E Test Sequence Completed.');
}

runE2ETest();
