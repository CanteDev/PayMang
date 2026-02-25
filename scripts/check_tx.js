const { createClient } = require('@supabase/supabase-js');
const sb = createClient('https://rjspuxdvpdwescrvudgz.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJqc3B1eGR2cGR3ZXNjcnZ1ZGd6Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MDYxMDU3MywiZXhwIjoyMDg2MTg2NTczfQ.axN7WqPgCf6OJRuyb3Bo1tGseSRH2NDLXFgvVBHllRQ');

async function check() {
    // Check commissions table columns
    const { data: c } = await sb.from('commissions').select('*').limit(1);
    if (c && c[0]) console.log('COMM KEYS:', Object.keys(c[0]).join(', '));
    else console.log('COMM: empty or error');

    // Try inserting a commission with payment_id to see if column exists
    const { error: testErr } = await sb.from('commissions').select('payment_id').limit(1);
    console.log('payment_id column test error:', testErr?.message || 'OK - column exists');

    // Check all_transactions view contents
    const { data: t, error: te } = await sb.from('all_transactions').select('id,type,status,amount,student_id').limit(5);
    console.log('ALL_TRANSACTIONS (5 rows):', JSON.stringify(t));
    if (te) console.log('TX ERROR:', te.message);

    // Check paid payments
    const { data: p, error: pe } = await sb.from('payments').select('id,status,amount,student_id').eq('status', 'paid').limit(3);
    console.log('PAID PAYMENTS:', JSON.stringify(p));
    if (pe) console.log('PAY ERROR:', pe.message);

    // Count commissions with payment_id vs sale_id
    const { data: cs } = await sb.from('commissions').select('sale_id, status').limit(10);
    console.log('COMMISSIONS sample:', JSON.stringify(cs));
}
check().catch(console.error);
