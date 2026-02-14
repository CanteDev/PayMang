import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import UnifiedLinkGenerator from '@/components/admin/UnifiedLinkGenerator';
import CommissionTable from '@/components/dashboard/CommissionTable';
import DashboardMetricsCards from '@/components/dashboard/DashboardMetricsCards';
import CommissionChart from '@/components/dashboard/CommissionChart';
import DashboardAlertCards from '@/components/dashboard/DashboardAlertCards';
import { getDashboardMetrics, getCommissionChartData } from '@/app/actions/dashboard';

export default async function AdminDashboard() {
    const supabase = await createClient();

    const {
        data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
        redirect('/login');
    }

    // Fetch Financial Metrics & Chart Data
    const metrics = await getDashboardMetrics();
    const chartData = await getCommissionChartData();

    return (
        <div className="space-y-8">
            <div>
                <h1 className="text-3xl font-semibold text-gray-900">Dashboard Admin</h1>
                <p className="text-gray-600 mt-1">Gestiona ventas, comisiones y equipo</p>
            </div>

            {/* Critical Alerts */}
            <DashboardAlertCards role="admin" />

            {/* Financial Metrics Cards */}
            <DashboardMetricsCards metrics={metrics} />

            {/* Grid Layout: Chart (2/3) + Link Generator (1/3) */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Generated vs Paid Chart */}
                <div className="lg:col-span-2 w-full">
                    <CommissionChart data={chartData} />
                </div>

                {/* Generador de Links */}
                <div className="lg:col-span-1">
                    <UnifiedLinkGenerator />
                </div>
            </div>


        </div>
    );
}
