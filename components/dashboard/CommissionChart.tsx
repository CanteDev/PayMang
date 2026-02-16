'use client';

import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend,
    ResponsiveContainer
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface ChartData {
    month: string;
    generated: number; // Base Layer (Unpaid)
    paid: number;      // Growth Layer (Paid)
    planned?: number;  // Predicted Layer (Planned)
}

interface CommissionChartProps {
    data: ChartData[];
}

export default function CommissionChart({ data }: CommissionChartProps) {
    return (
        <Card className="col-span-4 shadow-sm border-gray-200">
            <CardHeader>
                <CardTitle className="text-xl font-bold">Resumen Financiero y Previsión</CardTitle>
                <p className="text-sm text-gray-500">Histórico de 3 meses y previsión de 3 meses vista</p>
            </CardHeader>
            <CardContent className="pl-2">
                <div className="h-[350px] w-full max-w-4xl mx-auto">
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart
                            data={data}
                            margin={{
                                top: 20,
                                right: 30,
                                left: 20,
                                bottom: 5,
                            }}
                        >
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                            <XAxis
                                dataKey="month"
                                stroke="#94a3b8"
                                fontSize={12}
                                tickLine={false}
                                axisLine={false}
                            />
                            <YAxis
                                stroke="#94a3b8"
                                fontSize={12}
                                tickLine={false}
                                axisLine={false}
                                tickFormatter={(value) => `${value}€`}
                            />
                            <Tooltip
                                formatter={(value: any) => [`${Number(value).toFixed(2)}€`, '']}
                                cursor={{ fill: '#f8fafc' }}
                                contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                            />
                            <Legend wrapperStyle={{ paddingTop: '20px' }} />

                            <Bar
                                dataKey="paid"
                                name="Pagado (Ventas/Manual)"
                                fill="#3b82f6" // Blue 500
                                radius={[4, 4, 0, 0]}
                                barSize={40}
                            />
                            <Bar
                                dataKey="generated"
                                name="Pendiente Liquidar"
                                fill="#f87171" // Red 400
                                radius={[4, 4, 0, 0]}
                                barSize={20}
                            />
                            <Bar
                                dataKey="planned"
                                name="Previsión Cobros"
                                fill="#94a3b8" // Slate 400
                                radius={[4, 4, 0, 0]}
                                barSize={20}
                            />
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            </CardContent>
        </Card>
    );
}
