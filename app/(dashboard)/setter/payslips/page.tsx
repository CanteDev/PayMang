import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import LiquidationsView from '@/components/dashboard/LiquidationsView';

export default async function SetterPayslipsPage() {
    const supabase = await createClient();

    const {
        data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
        redirect('/login');
    }

    // Get profile with payment details
    const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

    if (!profile) {
        redirect('/login');
    }

    // Fetch paid commissions with related data
    const { data: commissions } = await supabase
        .from('commissions')
        .select(`
            *,
            sale:sales (
                id,
                total_amount,
                gateway,
                created_at,
                student:students (
                    id,
                    full_name,
                    email
                ),
                pack:packs (
                    id,
                    name
                )
            )
        `)
        .eq('agent_id', user.id)
        .eq('status', 'paid')
        .order('paid_at', { ascending: false });

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-semibold text-gray-900">Mis Liquidaciones</h1>
                <p className="text-gray-600 mt-1">Comisiones pagadas y validadas</p>
            </div>
            <LiquidationsView
                profile={profile}
                commissions={commissions || []}
            />
        </div>
    );
}
