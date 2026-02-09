import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import CommissionTable from '@/components/dashboard/CommissionTable';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DollarSign, TrendingUp } from 'lucide-react';

export default async function CloserDashboard() {
    const supabase = await createClient();

    const {
        data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
        redirect('/login');
    }

    // Obtener KPIs del closer
    const { data: commissions } = await supabase
        .from('commissions')
        .select('amount, status')
        .eq('agent_id', user.id);

    const totalEarned = commissions
        ?.filter(c => c.status === 'paid')
        .reduce((sum, c) => sum + c.amount, 0) || 0;

    const pending = commissions
        ?.filter(c => c.status === 'pending' || c.status === 'validated')
        .reduce((sum, c) => sum + c.amount, 0) || 0;

    return (
        <div className="space-y-8">
            <div>
                <h1 className="text-3xl font-semibold text-gray-900">Dashboard Closer</h1>
                <p className="text-gray-600 mt-1">Tus comisiones y rendimiento</p>
            </div>

            {/* KPIs */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-medium text-gray-600">
                            Total Pagado
                        </CardTitle>
                        <DollarSign className="w-4 h-4 text-gray-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-green-600">{totalEarned.toFixed(2)}€</div>
                        <p className="text-xs text-gray-500 mt-1">Comisiones cobradas</p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-medium text-gray-600">
                            Pendiente de Pago
                        </CardTitle>
                        <TrendingUp className="w-4 h-4 text-gray-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-amber-600">{pending.toFixed(2)}€</div>
                        <p className="text-xs text-gray-500 mt-1">En proceso</p>
                    </CardContent>
                </Card>
            </div>

            {/* Tabla de Comisiones */}
            <CommissionTable userRole="closer" userId={user.id} />
        </div>
    );
}
