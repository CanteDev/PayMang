import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function checkChart() {
    const startWindow = new Date(new Date().getFullYear(), new Date().getMonth() - 3, 1).toISOString();
    const endWindow = new Date(new Date().getFullYear(), new Date().getMonth() + 4, 0).toISOString();

    const payQuery = supabase
        .from('payments')
        .select('amount, due_date')
        .in('status', ['pending', 'overdue'])
        .gte('due_date', startWindow)
        .lte('due_date', endWindow);

    const { data: plannedPayments, error: err } = await payQuery;
    console.log('Planned payments found in window:', plannedPayments?.length, err);
}

checkChart();
