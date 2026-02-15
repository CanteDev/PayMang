import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import CommissionChart from '@/components/dashboard/CommissionChart';
import DashboardAlertCards from '@/components/dashboard/DashboardAlertCards';
import { getCommissionChartData } from '@/app/actions/dashboard';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Users } from 'lucide-react';

export default async function CoachDashboard() {
    const supabase = await createClient();

    const {
        data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
        redirect('/login');
    }

    // Obtener KPIs del coach (Alumnos Activos)
    const { count: myStudents } = await supabase
        .from('students')
        .select('*', { count: 'exact', head: true })
        .eq('assigned_coach_id', user.id)
        .eq('status', 'active');

    // Fetch User-specific Chart Data
    const chartData = await getCommissionChartData(user.id);

    return (
        <div className="space-y-8">
            <div>
                <h1 className="text-3xl font-semibold text-gray-900">Dashboard Coach</h1>
                <p className="text-gray-600 mt-1">Tus alumnos y comisiones</p>
            </div>

            <DashboardAlertCards role="coach" />

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
            </div>

            {/* Generated vs Paid Chart */}
            <div className="w-full max-w-5xl">
                <CommissionChart data={chartData} />
            </div>
        </div>
    );
}
