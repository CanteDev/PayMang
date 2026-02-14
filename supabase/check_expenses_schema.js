require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

async function checkSchema() {
    console.log('🔍 Checking expenses table schema...\n');

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceRoleKey) {
        console.error('❌ ERROR: Missing env vars');
        process.exit(1);
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Attempt 1: Try to insert valid row with 'start_date'
    console.log('Trying insert with start_date...');
    const { error: insertErrorStart } = await supabase
        .from('expenses')
        .insert({
            start_date: new Date().toISOString().split('T')[0],
            concept: 'Test Schema Start',
            amount: 10,
            category: 'Other',
            type: 'variable'
        })
        .select()
        .single();

    if (!insertErrorStart) {
        console.log('✅ Column "start_date" exists!');
        // Clean up
        await supabase.from('expenses').delete().eq('concept', 'Test Schema Start');
    } else {
        console.log('❌ Insert with start_date failed:', insertErrorStart.message);
    }

    // Attempt 2: Try to insert valid row with 'date'
    console.log('Trying insert with date...');
    const { error: insertErrorDate } = await supabase
        .from('expenses')
        .insert({
            date: new Date().toISOString().split('T')[0],
            concept: 'Test Schema Date',
            amount: 10,
            category: 'Other',
            type: 'variable'
        })
        .select()
        .single();

    if (!insertErrorDate) {
        console.log('✅ Column "date" exists!');
        // Clean up
        await supabase.from('expenses').delete().eq('concept', 'Test Schema Date');
    } else {
        console.log('❌ Insert with date failed:', insertErrorDate.message);
    }
}

checkSchema();
