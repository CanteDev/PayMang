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
                <div className="h-[350px] w-full">
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
                                formatter={(value: number) => [`${value.toFixed(2)}€`, 'Amount']}
                                cursor={{ fill: 'transparent' }}
                            />
                            <Legend />
                            {/* Base Layer: Generated but NOT Paid (Light Red) */}
                            <Bar
                                dataKey="generated"
                                name="Pendiente de Pago"
                                stackId="a"
                                fill="#fca5a5" // Light Red 
                                radius={[0, 0, 4, 4]}
                            />
                            {/* Growth Layer: Paid (Blue) */}
                            <Bar
                                dataKey="paid"
                                name="Pagado"
                                stackId="a"
                                fill="#3b82f6" // Blue
                                radius={[4, 4, 0, 0]}
                            />
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            </CardContent>
        </Card>
    );
}
