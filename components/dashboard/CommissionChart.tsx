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
}

interface CommissionChartProps {
    data: ChartData[];
}

export default function CommissionChart({ data }: CommissionChartProps) {
    return (
        <Card className="col-span-4">
            <CardHeader>
                <CardTitle>Progreso de Liquidación de Comisiones</CardTitle>
                <p className="text-sm text-gray-500">Generado (Pendiente) vs Pagado por mes</p>
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
                            <CartesianGrid strokeDasharray="3 3" vertical={false} />
                            <XAxis
                                dataKey="month"
                                stroke="#888888"
                                fontSize={12}
                                tickLine={false}
                                axisLine={false}
                            />
                            <YAxis
                                stroke="#888888"
                                fontSize={12}
                                tickLine={false}
                                axisLine={false}
                                tickFormatter={(value) => `${value}€`}
                            />
                            <Tooltip
                                formatter={(value: any) => [`${Number(value).toFixed(2)}€`, '']}
                                cursor={{ fill: 'transparent' }}
                                contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                            />
                            <Legend />
                            {/* Bar 1: Paid (Blue) */}
                            <Bar
                                dataKey="paid"
                                name="Pagado"
                                fill="#3b82f6" // Blue
                                radius={[4, 4, 0, 0]}
                                barSize={40}
                            />
                            {/* Bar 2: Pending (Red) */}
                            <Bar
                                dataKey="generated"
                                name="Pendiente"
                                fill="#fca5a5" // Light Red
                                radius={[4, 4, 0, 0]}
                                barSize={40}
                            />
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            </CardContent>
        </Card>
    );
}
