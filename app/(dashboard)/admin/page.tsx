import { createClient } from '@/lib/supabase/server';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { DollarSign, Users, TrendingUp, AlertCircle } from 'lucide-react';

export default async function AdminDashboard() {
    const supabase = await createClient();

    // KPIs básicos (placeholder - se implementarán queries reales)
    const stats = {
        totalRevenue: 45670.50,
        pendingCommissions: 3200.75,
        activeStudents: 48,
        openIncidences: 2,
    };

    return (
        <div className="space-y-8">
            {/* Header */}
            <div>
                <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
                <p className="text-gray-600 mt-1">Visión general del negocio</p>
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <Card className="rounded-2xl border-gray-200 shadow-md hover:shadow-lg transition-shadow duration-300">
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-medium text-gray-600">
                            Facturación Total
                        </CardTitle>
                        <DollarSign className="h-5 w-5 text-green-600" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-bold text-gray-900">
                            €{stats.totalRevenue.toFixed(2)}
                        </div>
                        <p className="text-xs text-gray-500 mt-1">
                            +12.5% vs mes anterior
                        </p>
                    </CardContent>
                </Card>

                <Card className="rounded-2xl border-gray-200 shadow-md hover:shadow-lg transition-shadow duration-300">
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-medium text-gray-600">
                            Comisiones Pendientes
                        </CardTitle>
                        <TrendingUp className="h-5 w-5 text-orange-600" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-bold text-gray-900">
                            €{stats.pendingCommissions.toFixed(2)}
                        </div>
                        <p className="text-xs text-gray-500 mt-1">
                            Por validar y pagar
                        </p>
                    </CardContent>
                </Card>

                <Card className="rounded-2xl border-gray-200 shadow-md hover:shadow-lg transition-shadow duration-300">
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-medium text-gray-600">
                            Alumnos Activos
                        </CardTitle>
                        <Users className="h-5 w-5 text-blue-600" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-bold text-gray-900">
                            {stats.activeStudents}
                        </div>
                        <p className="text-xs text-gray-500 mt-1">
                            +5 este mes
                        </p>
                    </CardContent>
                </Card>

                <Card className="rounded-2xl border-gray-200 shadow-md hover:shadow-lg transition-shadow duration-300">
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-medium text-gray-600">
                            Incidencias Abiertas
                        </CardTitle>
                        <AlertCircle className="h-5 w-5 text-red-600" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-bold text-gray-900">
                            {stats.openIncidences}
                        </div>
                        <p className="text-xs text-gray-500 mt-1">
                            Requieren atención
                        </p>
                    </CardContent>
                </Card>
            </div>

            {/* Placeholder para gráficos */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card className="rounded-2xl border-gray-200 shadow-md">
                    <CardHeader>
                        <CardTitle>Cash Flow Proyectado</CardTitle>
                        <CardDescription>Ingresos vs Gastos - Próximos 6 meses</CardDescription>
                    </CardHeader>
                    <CardContent className="h-64 flex items-center justify-center text-gray-400">
                        Gráfico de Cash Flow (Recharts)
                    </CardContent>
                </Card>

                <Card className="rounded-2xl border-gray-200 shadow-md">
                    <CardHeader>
                        <CardTitle>Ventas Recientes</CardTitle>
                        <CardDescription>Últimas transacciones registradas</CardDescription>
                    </CardHeader>
                    <CardContent className="h-64 flex items-center justify-center text-gray-400">
                        Tabla de ventas recientes
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
