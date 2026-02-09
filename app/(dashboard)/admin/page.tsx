import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DollarSign, Users, TrendingUp, AlertTriangle } from 'lucide-react';
import UnifiedLinkGenerator from '@/components/admin/UnifiedLinkGenerator';
import CommissionTable from '@/components/dashboard/CommissionTable';

export default async function AdminDashboard() {
    const supabase = await createClient();

    const {
        data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
        redirect('/login');
    }

    // Obtener KPIs básicos
    const { count: totalSales } = await supabase
        .from('sales')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'paid');

    const { data: pendingCommissions } = await supabase
        .from('commissions')
        .select('amount')
        .eq('status', 'pending');

    const pendingTotal = pendingCommissions?.reduce((sum, c) => sum + c.amount, 0) || 0;

    const { count: activeStudents } = await supabase
        .from('students')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'active');

    const { count: openIncidences } = await supabase
        .from('commissions')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'incidence');

    return (
        <div className="space-y-8">
            <div>
                <h1 className="text-3xl font-semibold text-gray-900">Dashboard Admin</h1>
                <p className="text-gray-600 mt-1">Gestiona ventas, comisiones y equipo</p>
            </div>

            {/* KPIs */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-medium text-gray-600">
                            Total Ventas
                        </CardTitle>
                        <DollarSign className="w-4 h-4 text-gray-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-gray-900">{totalSales || 0}</div>
                        <p className="text-xs text-gray-500 mt-1">Ventas completadas</p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-medium text-gray-600">
                            Comisiones Pendientes
                        </CardTitle>
                        <TrendingUp className="w-4 h-4 text-gray-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-amber-600">{pendingTotal.toFixed(2)}€</div>
                        <p className="text-xs text-gray-500 mt-1">Por pagar</p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-medium text-gray-600">
                            Alumnos Activos
                        </CardTitle>
                        <Users className="w-4 h-4 text-gray-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-gray-900">{activeStudents || 0}</div>
                        <p className="text-xs text-gray-500 mt-1">En programa</p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-medium text-gray-600">
                            Incidencias Abiertas
                        </CardTitle>
                        <AlertTriangle className="w-4 h-4 text-gray-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-red-600">{openIncidences || 0}</div>
                        <p className="text-xs text-gray-500 mt-1">Requieren atención</p>
                    </CardContent>
                </Card>
            </div>

            {/* Generador de Links */}
            <UnifiedLinkGenerator />

            {/* Tabla de Comisiones */}
            <CommissionTable userRole="admin" />
        </div>
    );
}
