import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

// Load env vars
dotenv.config({ path: path.join(process.cwd(), '.env') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ''; // Use service role to bypass RLS for initial check, or Anon to simulate user? 
// The user is likely using the app, so they are authenticated. 
// But "Service Role" helps me verify if it's a constraint issue first.
// If Service Role works, it's an RLS issue.

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing Supabase credentials');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function testCreateStudent() {
    console.log('Attempting to create student...');

    const studentData = {
        email: 'al1@al1.com',
        full_name: 'Test1',
        phone: '777777777',
        assigned_coach_id: null,
        status: 'active'
    };

    const { data, error } = await supabase
        .from('students')
        .insert(studentData)
        .select()
        .single();

    if (error) {
        console.error('❌ Error creating student:', error);
    } else {
        console.log('✅ Student created successfully:', data);
        // Cleanup
        await supabase.from('students').delete().eq('id', data.id);
    }
}

testCreateStudent();
