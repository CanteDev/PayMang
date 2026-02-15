import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import CommissionChart from '@/components/dashboard/CommissionChart';
import DashboardAlertCards from '@/components/dashboard/DashboardAlertCards';
import { getCommissionChartData } from '@/app/actions/dashboard';

export default async function SetterDashboard() {
    const supabase = await createClient();

    const {
        data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
        redirect('/login');
    }

    // Fetch User-specific Chart Data
    const chartData = await getCommissionChartData(user.id);

    return (
        <div className="space-y-8">
            <div>
                <h1 className="text-3xl font-semibold text-gray-900">Dashboard Setter</h1>
                <p className="text-gray-600 mt-1">Tu progreso de comisiones</p>
            </div>

            <DashboardAlertCards role="setter" />

            {/* Generated vs Paid Chart */}
            <div className="w-full max-w-5xl">
                <CommissionChart data={chartData} />
            </div>
        </div>
    );
}
