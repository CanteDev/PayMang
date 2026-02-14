'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow
} from '@/components/ui/table';
import { Download, Calendar } from 'lucide-react';
import { pdf } from '@react-pdf/renderer';
import CommissionPayslip from '@/components/pdf/CommissionPayslip';

interface Commission {
    id: string;
    amount: number;
    paid_at: string;
    sale?: {
        student?: {
            full_name: string;
            email: string;
        };
        pack?: {
            name: string;
        };
    };
}

interface Profile {
    full_name: string;
    role: string;
    payment_details?: string;
}

interface LiquidationsViewProps {
    profile: Profile;
    commissions: Commission[];
}

export default function LiquidationsView({ profile, commissions }: LiquidationsViewProps) {
    const [selectedMonth, setSelectedMonth] = useState<string>('');
    const [monthlyData, setMonthlyData] = useState<Record<string, Commission[]>>({});
    const [availableMonths, setAvailableMonths] = useState<string[]>([]);

    useEffect(() => {
        // Group commissions by month
        const grouped = commissions.reduce((acc, commission) => {
            const date = new Date(commission.paid_at);
            const key = `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}`;
            if (!acc[key]) acc[key] = [];
            acc[key].push(commission);
            return acc;
        }, {} as Record<string, Commission[]>);

        const months = Object.keys(grouped).sort().reverse();
        setMonthlyData(grouped);
        setAvailableMonths(months);

        // Select most recent month by default
        if (months.length > 0 && !selectedMonth) {
            setSelectedMonth(months[0]);
        }
    }, [commissions, selectedMonth]);

    const currentCommissions = selectedMonth ? monthlyData[selectedMonth] || [] : [];
    const totalAmount = currentCommissions.reduce((sum, c) => sum + c.amount, 0);

    const formatMonthLabel = (monthKey: string) => {
        const [year, month] = monthKey.split('-');
        const date = new Date(parseInt(year), parseInt(month) - 1);
        return date.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' });
    };

    const handleDownloadPDF = async () => {
        if (!selectedMonth) return;

        const blob = await pdf(
            <CommissionPayslip
                profile={profile}
                commissions={currentCommissions}
                month={selectedMonth}
            />
        ).toBlob();

        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `liquidacion_${selectedMonth}_${profile.full_name.replace(/\s+/g, '_')}.pdf`;
        link.click();
        URL.revokeObjectURL(url);
    };

    if (availableMonths.length === 0) {
        return (
            <Card>
                <CardContent className="p-8 text-center">
                    <p className="text-gray-500">No tienes comisiones pagadas aún.</p>
                </CardContent>
            </Card>
        );
    }

    return (
        <div className="space-y-6">
            {/* Month Selector */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Calendar className="w-5 h-5" />
                        Seleccionar Período
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <select
                        value={selectedMonth}
                        onChange={(e) => setSelectedMonth(e.target.value)}
                        className="flex h-10 w-full max-w-md rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                    >
                        {availableMonths.map((month) => (
                            <option key={month} value={month}>
                                {formatMonthLabel(month)}
                            </option>
                        ))}
                    </select>
                </CardContent>
            </Card>

            {/* Summary Card */}
            <Card>
                <CardHeader>
                    <div className="flex items-center justify-between">
                        <div>
                            <CardTitle className="text-2xl">
                                {formatMonthLabel(selectedMonth)}
                            </CardTitle>
                            <p className="text-sm text-gray-500 mt-1">
                                {currentCommissions.length} comisión{currentCommissions.length !== 1 ? 'es' : ''} pagada{currentCommissions.length !== 1 ? 's' : ''}
                            </p>
                        </div>
                        <Button onClick={handleDownloadPDF} className="gap-2">
                            <Download className="w-4 h-4" />
                            Descargar PDF
                        </Button>
                    </div>
                </CardHeader>
                <CardContent>
                    <div className="bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-lg p-6">
                        <p className="text-sm text-gray-600 mb-1">Total Liquidado</p>
                        <p className="text-4xl font-bold text-green-700">{totalAmount.toFixed(2)}€</p>
                    </div>
                </CardContent>
            </Card>

            {/* Detailed Table */}
            <Card>
                <CardHeader>
                    <CardTitle>Detalle de Comisiones</CardTitle>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Fecha de Pago</TableHead>
                                <TableHead>Alumno</TableHead>
                                <TableHead>Pack</TableHead>
                                <TableHead className="text-right">Importe</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {currentCommissions.map((commission) => (
                                <TableRow key={commission.id}>
                                    <TableCell>
                                        {new Date(commission.paid_at).toLocaleDateString('es-ES')}
                                    </TableCell>
                                    <TableCell>
                                        {commission.sale?.student?.full_name || commission.sale?.student?.email || '-'}
                                    </TableCell>
                                    <TableCell>
                                        {commission.sale?.pack?.name || '-'}
                                    </TableCell>
                                    <TableCell className="text-right font-semibold">
                                        {commission.amount.toFixed(2)}€
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        </div>
    );
}
