'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DollarSign, TrendingUp, Clock, Flame } from 'lucide-react';

interface MetricsProps {
    metrics: {
        totalRevenue: number;
        netCashFlow: number;
        pendingPayouts: number;
        burnRate: number;
    } | null;
}

export default function DashboardMetricsCards({ metrics }: MetricsProps) {
    if (!metrics) {
        return <div className="text-gray-500">No hay datos disponibles</div>;
    }

    const { totalRevenue, netCashFlow, pendingPayouts, burnRate } = metrics;

    const cards = [
        {
            title: 'Ingresos Totales (Bruto)',
            value: totalRevenue,
            icon: DollarSign,
            color: 'text-green-600',
            bgColor: 'bg-green-100',
            description: 'Total de ventas de todas las pasarelas'
        },
        {
            title: 'Flujo de Caja Neto',
            value: netCashFlow,
            icon: TrendingUp,
            color: 'text-blue-600',
            bgColor: 'bg-blue-100',
            description: 'Ingresos - Comisiones Pagadas - Gastos'
        },
        {
            title: 'Pagos Pendientes',
            value: pendingPayouts,
            icon: Clock,
            color: 'text-yellow-600',
            bgColor: 'bg-yellow-100',
            description: 'Comisiones Validadas o Pendientes'
        },
        {
            title: 'Gastos del Mes',
            value: burnRate,
            icon: Flame,
            color: 'text-red-600',
            bgColor: 'bg-red-100',
            description: 'Fijos y Variables de este mes'
        }
    ];

    return (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {cards.map((card, index) => (
                <Card key={index}>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">
                            {card.title}
                        </CardTitle>
                        <div className={`p-2 rounded-full ${card.bgColor}`}>
                            <card.icon className={`h-4 w-4 ${card.color}`} />
                        </div>
                    </CardHeader>
                    <CardContent>
                        <div className={`text-2xl font-bold ${card.color}`}>
                            {card.value.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                            {card.description}
                        </p>
                    </CardContent>
                </Card>
            ))}
        </div>
    );
}
