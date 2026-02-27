'use client';

import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
    Table, TableBody, TableCell, TableHead,
    TableHeader, TableRow
} from '@/components/ui/table';
import { Download, Calendar, Users, FileText, TrendingUp } from 'lucide-react';
import { pdf } from '@react-pdf/renderer';
import CommissionPayslip from '@/components/pdf/CommissionPayslip';

interface Commission {
    id: string;
    amount: number;
    paid_at: string;
    role_at_sale: string;
    sale?: {
        student?: { full_name: string; email: string };
        pack?: { name: string };
    };
}

interface StaffMember {
    id: string;
    full_name: string;
    role: string;
    email: string;
    payment_details?: string;
    commissions: Commission[];
}

interface AdminPayslipsViewProps {
    staffMembers: StaffMember[];
}

const ROLE_LABELS: Record<string, string> = {
    closer: 'Closer',
    coach: 'Coach',
    setter: 'Setter',
    admin: 'Admin',
};

const ROLE_COLORS: Record<string, string> = {
    closer: 'bg-purple-100 text-purple-700',
    coach: 'bg-blue-100 text-blue-700',
    setter: 'bg-amber-100 text-amber-700',
    admin: 'bg-gray-100 text-gray-700',
};

export default function AdminPayslipsView({ staffMembers }: AdminPayslipsViewProps) {
    const [roleFilter, setRoleFilter] = useState<string>('all');
    const [selectedStaffId, setSelectedStaffId] = useState<string>('');
    const [selectedMonth, setSelectedMonth] = useState<string>('');
    const [downloading, setDownloading] = useState(false);

    // Filtered staff list by role
    const filteredStaff = useMemo(() =>
        staffMembers.filter(s =>
            roleFilter === 'all' ? true : s.role === roleFilter
        ),
        [staffMembers, roleFilter]
    );

    // Reset staff selection when role filter changes
    useEffect(() => {
        setSelectedStaffId('');
        setSelectedMonth('');
    }, [roleFilter]);

    // Reset month when staff changes
    useEffect(() => {
        setSelectedMonth('');
    }, [selectedStaffId]);

    const selectedStaff = staffMembers.find(s => s.id === selectedStaffId);

    // Group commissions of selected staff by month
    const monthlyData = useMemo(() => {
        if (!selectedStaff) return {} as Record<string, Commission[]>;
        return selectedStaff.commissions.reduce((acc, c) => {
            const date = new Date(c.paid_at);
            const key = `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}`;
            if (!acc[key]) acc[key] = [];
            acc[key].push(c);
            return acc;
        }, {} as Record<string, Commission[]>);
    }, [selectedStaff]);

    const availableMonths = useMemo(() =>
        Object.keys(monthlyData).sort().reverse(),
        [monthlyData]
    );

    // Auto-select most recent month when staff changes
    useEffect(() => {
        if (availableMonths.length > 0 && !selectedMonth) {
            setSelectedMonth(availableMonths[0]);
        }
    }, [availableMonths, selectedMonth]);

    const currentCommissions = selectedMonth ? (monthlyData[selectedMonth] || []) : [];
    const totalMonth = currentCommissions.reduce((sum, c) => sum + c.amount, 0);
    const totalAllTime = selectedStaff?.commissions.reduce((sum, c) => sum + c.amount, 0) || 0;

    const formatMonthLabel = (key: string) => {
        const [year, month] = key.split('-');
        return new Date(parseInt(year), parseInt(month) - 1)
            .toLocaleDateString('es-ES', { month: 'long', year: 'numeric' });
    };

    const handleDownloadPDF = async () => {
        if (!selectedStaff || !selectedMonth) return;
        setDownloading(true);
        try {
            const blob = await pdf(
                <CommissionPayslip
                    profile={{
                        full_name: selectedStaff.full_name,
                        role: selectedStaff.role,
                        payment_details: selectedStaff.payment_details,
                    }}
                    commissions={currentCommissions}
                    month={selectedMonth}
                />
            ).toBlob();
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `liquidacion_${selectedMonth}_${selectedStaff.full_name.replace(/\s+/g, '_')}.pdf`;
            link.click();
            URL.revokeObjectURL(url);
        } finally {
            setDownloading(false);
        }
    };

    // Summary stats across all staff
    const totalByRole = useMemo(() => {
        const summary: Record<string, { count: number; total: number }> = {};
        staffMembers.forEach(s => {
            if (!summary[s.role]) summary[s.role] = { count: 0, total: 0 };
            summary[s.role].count++;
            summary[s.role].total += s.commissions.reduce((sum, c) => sum + c.amount, 0);
        });
        return summary;
    }, [staffMembers]);

    return (
        <div className="space-y-6">

            {/* Stats Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {(['closer', 'coach', 'setter'] as const).map(role => (
                    <Card
                        key={role}
                        className={`cursor-pointer transition-all border-2 ${roleFilter === role ? 'border-blue-500 shadow-md' : 'border-transparent hover:border-gray-200'}`}
                        onClick={() => setRoleFilter(prev => prev === role ? 'all' : role)}
                    >
                        <CardContent className="p-4">
                            <div className="flex items-center justify-between mb-2">
                                <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${ROLE_COLORS[role]}`}>
                                    {ROLE_LABELS[role]}
                                </span>
                                <Users className="w-4 h-4 text-gray-400" />
                            </div>
                            <p className="text-2xl font-bold text-gray-900">
                                {(totalByRole[role]?.total || 0).toFixed(2)}€
                            </p>
                            <p className="text-xs text-gray-500 mt-1">
                                {totalByRole[role]?.count || 0} miembro{(totalByRole[role]?.count || 0) !== 1 ? 's' : ''} · Comisiones pagadas
                            </p>
                        </CardContent>
                    </Card>
                ))}
            </div>

            {/* Selector Panel */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-base">
                        <FileText className="w-4 h-4" />
                        Generar Liquidación
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {/* Role Filter */}
                        <div className="space-y-1">
                            <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Rol</label>
                            <select
                                value={roleFilter}
                                onChange={e => setRoleFilter(e.target.value)}
                                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                            >
                                <option value="all">Todos los roles</option>
                                <option value="closer">Closer</option>
                                <option value="coach">Coach</option>
                                <option value="setter">Setter</option>
                            </select>
                        </div>

                        {/* Staff Selector */}
                        <div className="space-y-1">
                            <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Persona</label>
                            <select
                                value={selectedStaffId}
                                onChange={e => setSelectedStaffId(e.target.value)}
                                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                            >
                                <option value="">Seleccionar persona...</option>
                                {filteredStaff.map(s => (
                                    <option key={s.id} value={s.id}>
                                        {s.full_name} ({ROLE_LABELS[s.role] || s.role})
                                    </option>
                                ))}
                            </select>
                        </div>

                        {/* Month Selector */}
                        <div className="space-y-1">
                            <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Período</label>
                            <select
                                value={selectedMonth}
                                onChange={e => setSelectedMonth(e.target.value)}
                                disabled={!selectedStaffId || availableMonths.length === 0}
                                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                <option value="">
                                    {selectedStaffId && availableMonths.length === 0
                                        ? 'Sin comisiones pagadas'
                                        : 'Seleccionar mes...'
                                    }
                                </option>
                                {availableMonths.map(m => (
                                    <option key={m} value={m}>{formatMonthLabel(m)}</option>
                                ))}
                            </select>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Detail Panel - only shown when staff + month selected */}
            {selectedStaff && selectedMonth && (
                <>
                    {/* Summary */}
                    <Card>
                        <CardHeader>
                            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                                <div>
                                    <CardTitle className="text-xl">{selectedStaff.full_name}</CardTitle>
                                    <div className="flex items-center gap-3 mt-1">
                                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${ROLE_COLORS[selectedStaff.role]}`}>
                                            {ROLE_LABELS[selectedStaff.role]}
                                        </span>
                                        <span className="text-sm text-gray-500 flex items-center gap-1">
                                            <Calendar className="w-3 h-3" />
                                            {formatMonthLabel(selectedMonth)}
                                        </span>
                                        <span className="text-sm text-gray-400">
                                            {currentCommissions.length} comisión{currentCommissions.length !== 1 ? 'es' : ''}
                                        </span>
                                    </div>
                                </div>
                                <Button
                                    onClick={handleDownloadPDF}
                                    disabled={downloading || currentCommissions.length === 0}
                                    className="gap-2 sm:self-start"
                                >
                                    <Download className="w-4 h-4" />
                                    {downloading ? 'Generando...' : 'Descargar PDF'}
                                </Button>
                            </div>
                        </CardHeader>
                        <CardContent>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-lg p-4">
                                    <p className="text-xs text-gray-500 mb-1">Este mes</p>
                                    <p className="text-3xl font-bold text-green-700">{totalMonth.toFixed(2)}€</p>
                                </div>
                                <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg p-4">
                                    <div className="flex items-center gap-1 mb-1">
                                        <TrendingUp className="w-3 h-3 text-gray-400" />
                                        <p className="text-xs text-gray-500">Total histórico</p>
                                    </div>
                                    <p className="text-3xl font-bold text-blue-700">{totalAllTime.toFixed(2)}€</p>
                                </div>
                            </div>
                            {selectedStaff.payment_details && (
                                <div className="mt-4 p-3 bg-gray-50 rounded-lg border border-gray-200">
                                    <p className="text-xs text-gray-500 font-medium">Datos de pago</p>
                                    <p className="text-sm text-gray-700 mt-0.5">{selectedStaff.payment_details}</p>
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    {/* Commissions Table */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-base">Detalle de Comisiones — {formatMonthLabel(selectedMonth)}</CardTitle>
                        </CardHeader>
                        <CardContent>
                            {currentCommissions.length === 0 ? (
                                <p className="text-center text-gray-500 py-8">No hay comisiones pagadas en este período.</p>
                            ) : (
                                <Table>
                                    <TableHeader>
                                        <TableRow className="bg-gray-50">
                                            <TableHead>Fecha de Pago</TableHead>
                                            <TableHead>Alumno</TableHead>
                                            <TableHead>Pack</TableHead>
                                            <TableHead>Tipo</TableHead>
                                            <TableHead className="text-right">Importe</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {currentCommissions.map(c => (
                                            <TableRow key={c.id}>
                                                <TableCell className="text-gray-500 text-sm">
                                                    {new Date(c.paid_at).toLocaleDateString('es-ES')}
                                                </TableCell>
                                                <TableCell>
                                                    {c.sale?.student?.full_name || c.sale?.student?.email || <span className="text-gray-400 italic">Manual</span>}
                                                </TableCell>
                                                <TableCell>
                                                    {c.sale?.pack?.name || <span className="text-gray-400">—</span>}
                                                </TableCell>
                                                <TableCell>
                                                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${ROLE_COLORS[c.role_at_sale] || 'bg-gray-100 text-gray-600'}`}>
                                                        {ROLE_LABELS[c.role_at_sale] || c.role_at_sale}
                                                    </span>
                                                </TableCell>
                                                <TableCell className="text-right font-semibold text-green-700">
                                                    {c.amount.toFixed(2)}€
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            )}
                        </CardContent>
                    </Card>
                </>
            )}

            {/* Placeholder when nothing selected */}
            {!selectedStaffId && (
                <Card className="border-dashed">
                    <CardContent className="py-16 text-center">
                        <FileText className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                        <p className="text-gray-500 font-medium">Selecciona un miembro del equipo</p>
                        <p className="text-gray-400 text-sm mt-1">para ver y generar su liquidación de comisiones</p>
                    </CardContent>
                </Card>
            )}
        </div>
    );
}
