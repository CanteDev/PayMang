import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import AdminPayslipsView from '@/components/admin/AdminPayslipsView';

export default async function AdminLiquidationsPage() {
    const supabase = await createClient();

    const {
        data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
        redirect('/login');
    }

    // Verify admin role
    const { data: adminProfile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single();

    if (!adminProfile || (adminProfile as any).role !== 'admin') {
        redirect('/dashboard');
    }

    // Fetch all staff members (closer, coach, setter)
    const { data: staff } = await supabase
        .from('profiles')
        .select(`
            id,
            full_name,
            role,
            email,
            payment_details
        `)
        .in('role', ['closer', 'coach', 'setter'])
        .order('full_name');

    if (!staff) {
        return <div>Error al cargar personal</div>;
    }

    // Fetch all paid commissions with related data for these staff members
    const { data: commissions } = await supabase
        .from('commissions')
        .select(`
            id,
            amount,
            paid_at,
            agent_id,
            role_at_sale,
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
        .eq('status', 'paid')
        .in('agent_id', (staff as any[]).map(s => s.id))
        .order('paid_at', { ascending: false });

    // Map commissions to staff members
    const staffWithCommissions = (staff as any[]).map(member => ({
        ...member,
        commissions: (commissions || []).filter((c: any) => c.agent_id === member.id)
    }));

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-semibold text-gray-900">Liquidaciones</h1>
                <p className="text-gray-600 mt-1">Generación de PDFs de liquidación para el equipo</p>
            </div>

            <AdminPayslipsView staffMembers={staffWithCommissions as any} />
        </div>
    );
}
