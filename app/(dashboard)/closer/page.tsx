import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import CommissionChart from '@/components/dashboard/CommissionChart';
import DashboardAlertCards from '@/components/dashboard/DashboardAlertCards';
import { getCommissionChartData } from '@/app/actions/dashboard';
import UnifiedLinkGenerator from '@/components/admin/UnifiedLinkGenerator';

export default async function CloserDashboard() {
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
                <h1 className="text-3xl font-semibold text-gray-900">Dashboard Closer</h1>
                <p className="text-gray-600 mt-1">Tu progreso de comisiones</p>
            </div>

            <DashboardAlertCards role="closer" />

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
