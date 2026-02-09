import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import CommissionTable from '@/components/dashboard/CommissionTable';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DollarSign, Users, CheckCircle2 } from 'lucide-react';

export default async function CoachDashboard() {
    const supabase = await createClient();

    const {
        data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
        redirect('/login');
    }

    // Obtener KPIs del coach
    const { count: myStudents } = await supabase
        .from('students')
        .select('*', { count: 'exact', head: true })
        .eq('assigned_coach_id', user.id)
        .eq('status', 'active');

    const { data: commissions } = await supabase
        .from('commissions')
        .select('amount, status')
        .eq('agent_id', user.id);

    const totalEarned = commissions
        ?.filter(c => c.status === 'paid')
        .reduce((sum, c) => sum + c.amount, 0) || 0;

    const needsValidation = commissions
        ?.filter(c => c.status === 'pending')
        .length || 0;

    return (
        <div className="space-y-8">
            <div>
                <h1 className="text-3xl font-semibold text-gray-900">Dashboard Coach</h1>
                <p className="text-gray-600 mt-1">Tus alumnos y comisiones</p>
            </div>

            {/* KPIs */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-medium text-gray-600">
                            Mis Alumnos
                        </CardTitle>
                        <Users className="w-4 h-4 text-gray-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-gray-900">{myStudents || 0}</div>
                        <p className="text-xs text-gray-500 mt-1">Activos</p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-medium text-gray-600">
                            Total Cobrado
                        </CardTitle>
                        <DollarSign className="w-4 h-4 text-gray-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-green-600">{totalEarned.toFixed(2)}€</div>
                        <p className="text-xs text-gray-500 mt-1">Comisiones pagadas</p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-medium text-gray-600">
                            Por Validar
                        </CardTitle>
                        <CheckCircle2 className="w-4 h-4 text-gray-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-amber-600">{needsValidation}</div>
                        <p className="text-xs text-gray-500 mt-1">Comisiones pendientes</p>
                    </CardContent>
                </Card>
            </div>

            {/* Tabla de Comisiones */}
            <CommissionTable userRole="coach" userId={user.id} />
        </div>
    );
}
