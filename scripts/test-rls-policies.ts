import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

// Load env vars
dotenv.config({ path: path.join(process.cwd(), '.env') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''; // Use ANON key for auth login

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing Supabase credentials');
    process.exit(1);
}

const TEST_PASSWORD = 'Password123!';

async function runTests() {
    console.log('Starting RLS Policy Verification...\n');

    // ==========================================
    // TEST 0: ADMIN (Should be able to CREATE Student)
    // ==========================================
    console.log('--- TEST 0: ADMIN ROLE ---');
    const adminClient = createClient(supabaseUrl, supabaseKey);
    const { data: adminSession, error: adminLoginError } = await adminClient.auth.signInWithPassword({
        email: 'admin@paymang.com',
        password: 'PrimaveraVerano.01' // Assuming this is still the password from setup
    });

    if (adminLoginError) {
        console.error('❌ Admin Login Failed:', adminLoginError.message);
    } else {
        console.log('✅ Admin Logged In');
        const { data: adminStudent, error: adminCreateError } = await adminClient
            .from('students')
            .insert({
                email: `admin_student_${Date.now()}@test.com`,
                full_name: 'Admin Created Student',
                status: 'active'
            })
            .select()
            .single();

        if (adminCreateError) {
            console.error('❌ Admin FAILED to create student:', adminCreateError.message);
        } else {
            console.log('✅ Admin SUCCESSFULLY created student:', adminStudent.id);
            await adminClient.from('students').delete().eq('id', adminStudent.id);
        }
    }
    console.log('\n');

    // ==========================================
    // TEST 1: CLOSER (Should be able to CREATE Student)
    // ==========================================
    console.log('--- TEST 1: CLOSER ROLE ---');
    const closerClient = createClient(supabaseUrl, supabaseKey);
    const { data: closerSession, error: closerLoginError } = await closerClient.auth.signInWithPassword({
        email: 'closer@test.com',
        password: TEST_PASSWORD
    });

    if (closerLoginError) {
        console.error('❌ Closer Login Failed:', closerLoginError.message);
    } else {
        console.log('✅ Closer Logged In');

        // Attempt to Create Student
        const newStudent = {
            email: `student_${Date.now()}@test.com`,
            full_name: 'Closer Created Student',
            status: 'active'
        };

        const { data: createdStudent, error: createError } = await closerClient
            .from('students')
            .insert(newStudent)
            .select()
            .single();

        if (createError) {
            console.error('❌ Closer FAILED to create student:', createError.message);
            console.error('   -> RLS Policy "students_insert_closer" might be missing or incorrect.');
        } else {
            console.log('✅ Closer SUCCESSFULLY created student:', createdStudent.id);
            // Cleanup (Closer might not be able to delete? Let's try)
            const { error: deleteError } = await closerClient.from('students').delete().eq('id', createdStudent.id);
            if (deleteError) {
                console.log('   (Closer cannot delete student - this is expected/secure)');
                // Use admin to cleanup later if needed, but for now we leave it or verify deletion failure
            }
        }
    }
    console.log('\n');


    // ==========================================
    // TEST 2: COACH (Should ONLY see assigned students)
    // ==========================================
    console.log('--- TEST 2: COACH ROLE ---');
    const coachClient = createClient(supabaseUrl, supabaseKey);
    const { data: coachSession, error: coachLoginError } = await coachClient.auth.signInWithPassword({
        email: 'coach@test.com',
        password: TEST_PASSWORD
    });

    if (coachLoginError) {
        console.error('❌ Coach Login Failed:', coachLoginError.message);
    } else {
        console.log('✅ Coach Logged In');

        // Fetch Students
        const { data: students, error: fetchError } = await coachClient
            .from('students')
            .select('*');

        if (fetchError) {
            console.error('❌ Coach failed to fetch students:', fetchError.message);
        } else {
            console.log(`✅ Coach fetched ${students.length} students.`);
            // Verify none of them are unassigned or assigned to others (unless logic allows unassigned?)
            // Policy says: assigned_coach_id = auth.uid()
            const invalidStudents = students.filter(s => s.assigned_coach_id !== coachSession.user.id);
            if (invalidStudents.length > 0) {
                console.error('❌ RLS FAILURE: Coach sees students not assigned to them!');
            } else {
                console.log('✅ RLS SUCCESS: Coach only sees assigned students.');
            }
        }

        // Attempt to Create Student (Should FAIL)
        const newStudentCoach = {
            email: `coach_student_${Date.now()}@test.com`,
            full_name: 'Coach Created Student',
            status: 'active'
        };
        const { error: coachCreateError } = await coachClient.from('students').insert(newStudentCoach);
        if (coachCreateError) {
            console.log('✅ RLS SUCCESS: Coach properly BLOCKED from creating students.');
        } else {
            console.error('❌ RLS FAILURE: Coach was able to create a student!');
        }
    }
    console.log('\n');

    // ==========================================
    // TEST 3: SETTER (Should NOT create students)
    // ==========================================
    console.log('--- TEST 3: SETTER ROLE ---');
    const setterClient = createClient(supabaseUrl, supabaseKey);
    const { error: setterLoginError } = await setterClient.auth.signInWithPassword({
        email: 'setter@test.com',
        password: TEST_PASSWORD
    });

    if (setterLoginError) {
        console.error('❌ Setter Login Failed:', setterLoginError.message);
    } else {
        console.log('✅ Setter Logged In');
        const { error: setterCreateError } = await setterClient.from('students').insert({
            email: `setter_${Date.now()}@test.com`,
            full_name: 'Setter Bad',
            status: 'active'
        });

        if (setterCreateError) {
            console.log('✅ RLS SUCCESS: Setter properly BLOCKED from creating students.');
        } else {
            console.error('❌ RLS FAILURE: Setter was able to create a student!');
        }
    }
}

runTests();
