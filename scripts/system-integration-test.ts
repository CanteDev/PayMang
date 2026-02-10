import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
// Load env vars
dotenv.config({ path: path.join(process.cwd(), '.env') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

if (!supabaseUrl || !serviceRoleKey) {
    console.error('Missing Supabase credentials');
    process.exit(1);
}

// Clients
const adminClient = createClient(supabaseUrl, serviceRoleKey); // Admin privileges for cleanup/setup
const closerClient = createClient(supabaseUrl, supabaseKey);

const TEST_PASSWORD = 'Password123!';
const API_URL = 'http://localhost:3000';

async function runSystemTest() {
    console.log('🚀 STARTED: Full System Integration Test\n');

    let studentId = '';
    let linkId = '';
    let packId = '';

    try {
        // 1. SETUP: Get a Pack
        console.log('🔹 [SETUP] Fetching active Pack...');
        const { data: packs } = await adminClient.from('packs').select('id, price').eq('is_active', true).limit(1);
        if (!packs || packs.length === 0) throw new Error('No active packs found. Please create one.');
        packId = packs[0].id;
        console.log(`   -> Pack ID: ${packId}`);

        // 2. LOGIN: CLOSER
        console.log('\n🔹 [CLOSER] Logging in...');
        const { data: closerSession, error: loginError } = await closerClient.auth.signInWithPassword({
            email: 'closer@test.com',
            password: TEST_PASSWORD
        });
        if (loginError) throw new Error(`Closer login failed: ${loginError.message}`);
        console.log(`   -> Logged in as: ${closerSession.user.email} (${closerSession.user.id})`);

        // 3. CREATE STUDENT (As Closer)
        console.log('\n🔹 [CLOSER] Creating Student...');
        const newStudent = {
            email: `system_test_${Date.now()}@test.com`,
            full_name: 'System Test Student',
            status: 'active',
            // Assign to 'coach@test.com' if possible, need coach ID.
            // Let's first find the coach ID using Admin client
        };

        // Find Coach ID
        const { data: coaches } = await adminClient.from('profiles').select('id').eq('role', 'coach').limit(1);
        const coachId = coaches?.[0]?.id;
        if (coachId) {
            // @ts-ignore
            newStudent.assigned_coach_id = coachId;
            console.log(`   -> Assigning to Coach ID: ${coachId}`);
        } else {
            console.warn('   -> No Coach found. Student will be unassigned.');
        }

        const { data: student, error: createError } = await closerClient
            .from('students')
            .insert(newStudent)
            .select()
            .single();

        if (createError) throw new Error(`Closer failed to create student: ${createError.message}`);
        studentId = student.id;
        console.log(`   -> Student Created: ${student.id} (${student.email})`);

        // 4. GENERATE LINK (As Closer)
        console.log('\n🔹 [CLOSER] Generating Payment Link...');
        const linkData = {
            id: `test_${Date.now().toString().slice(-6)}`, // Short code
            student_id: studentId,
            pack_id: packId,
            gateway: 'stripe', // Mock gateway
            status: 'pending',
            created_by: closerSession.user.id,
            metadata: {
                closer_id: closerSession.user.id,
                coach_id: coachId,
                setter_id: null
            }
        };

        const { error: linkError } = await closerClient.from('payment_links').insert(linkData);
        if (linkError) throw new Error(`Failed to create link: ${linkError.message}`);
        linkId = linkData.id;
        console.log(`   -> Link Generated: ${linkId}`);

        // 5. SIMULATE PAYMENT (Via API)
        console.log('\n🔹 [SYSTEM] Simulating Payment via API...');
        console.log(`   -> POST ${API_URL}/api/test/simulate-payment`);

        const response = await fetch(`${API_URL}/api/test/simulate-payment`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ linkId: linkId })
        });

        const result = await response.json();
        if (!response.ok) throw new Error(`API Error: ${result.error || response.statusText}`);

        console.log(`   -> API Response: ${result.message}`);

        // 6. VERIFY COMMISSIONS (As Admin)
        console.log('\n🔹 [ADMIN] Verifying Commissions...');
        // Wait a moment for DB triggers/logic if async? 
        // Logic seems synchronous in API route (it awaits).

        // Find sale first
        const { data: sale } = await adminClient.from('sales').select('id').eq('student_id', studentId).single();
        if (!sale) throw new Error('Sale record not found!');
        console.log(`   -> Sale Record Found: ${sale.id}`);

        const { data: commissions } = await adminClient.from('commissions').select('*').eq('sale_id', sale.id);
        console.log(`   -> Commissions Found: ${commissions?.length || 0}`);

        if (!commissions || commissions.length === 0) throw new Error('No commissions generated!');

        commissions.forEach(c => {
            console.log(`      - Agent: ${c.agent_id} | Role: ${c.role_at_sale} | Amount: ${c.amount} | Status: ${c.status}`);
        });

        console.log('\n✅ TEST COMPLETED SUCCESSFULLY');

    } catch (err: any) {
        console.error('\n❌ TEST FAILED:', err.message);
        if (err.cause) console.error(err.cause);
    } finally {
        // Cleanup
        if (studentId) {
            console.log('\n🔹 [CLEANUP] Deleting test student...');
            await adminClient.from('students').delete().eq('id', studentId);
        }
    }
}

runSystemTest();
