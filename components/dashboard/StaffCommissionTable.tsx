'use client';

import { useState, useEffect } from 'react';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow
} from '@/components/ui/table';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { getStaffCommissionStats } from '@/app/actions/dashboard';
import { validateCommission, reportIncidence } from '@/app/actions/commissions';
import { DollarSign, CheckCircle2, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';

interface StaffCommissionTableProps {
    userId: string;
}

export default function StaffCommissionTable({ userId }: StaffCommissionTableProps) {
    const [commissions, setCommissions] = useState<any[]>([]);
    const [summary, setSummary] = useState({
        generatedThisMonth: 0,
        received: 0,
        remaining: 0
    });
    const [loading, setLoading] = useState(true);

    // Incidence Dialog State
    const [isIncidenceOpen, setIsIncidenceOpen] = useState(false);
    const [selectedCommissionId, setSelectedCommissionId] = useState<string | null>(null);
    const [incidenceNote, setIncidenceNote] = useState('');

    const fetchCheck = async () => {
        setLoading(true);
        try {
            const result = await getStaffCommissionStats(userId);
            if (result) {
                setCommissions(result.commissions);
                setSummary(result.summary);
            }
        } catch (error) {
            console.error('Error fetching staff stats:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchCheck();
    }, [userId]);

    const handleValidate = async (id: string) => {
        try {
            const result = await validateCommission(id);
            if (result.error) {
                toast.error(result.error);
                return;
            }
            toast.success('Comisión validada correctamente');
            fetchCheck();
        } catch (error) {
            toast.error('Error al validar');
        }
    };

    const handleOpenIncidence = (id: string) => {
        setSelectedCommissionId(id);
        setIncidenceNote('');
        setIsIncidenceOpen(true);
    };

    const handleSubmitIncidence = async () => {
        if (!selectedCommissionId || !incidenceNote.trim()) {
            toast.error('Debes escribir una nota');
            return;
        }

        try {
            const result = await reportIncidence(selectedCommissionId, incidenceNote);
            if (result.error) {
                toast.error(result.error);
                return;
            }
            toast.success('Incidencia reportada');
            setIsIncidenceOpen(false);
            fetchCheck();
        } catch (error) {
            toast.error('Error al reportar incidencia');
        }
    };

    const getStatusBadge = (status: string) => {
        const styles = {
            pending: 'bg-yellow-100 text-yellow-700 border-yellow-200',
            incidence: 'bg-red-100 text-red-700 border-red-200',
            validated: 'bg-blue-100 text-blue-700 border-blue-200',
            paid: 'bg-green-100 text-green-700 border-green-200',
            cancelled: 'bg-gray-100 text-gray-700 border-gray-200',
        };

        const labels = {
            pending: 'Pendiente',
            incidence: 'Incidencia',
            validated: 'Validado',
            paid: 'Pagado',
            cancelled: 'Cancelada',
        };

        return (
            <span className={`px-2 py-1 rounded-md text-xs font-medium border ${styles[status as keyof typeof styles]}`}>
                {labels[status as keyof typeof labels] || status}
            </span>
        );
    };

    return (
        <div className="space-y-6">
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center space-x-2">
                        <DollarSign className="w-5 h-5" />
                        <span>Mis Comisiones</span>
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="border rounded-lg overflow-hidden">
                        <Table>
                            <TableHeader>
                                <TableRow className="bg-gray-50">
                                    <TableHead>Fecha</TableHead>
                                    <TableHead>Alumno</TableHead>
                                    <TableHead>Pack</TableHead>
                                    <TableHead className="text-right">Importe</TableHead>
                                    <TableHead className="text-center">Estado</TableHead>
                                    <TableHead className="text-right">Acciones</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {loading ? (
                                    <TableRow>
                                        <TableCell colSpan={6} className="text-center py-8">Cargando...</TableCell>
                                    </TableRow>
                                ) : commissions.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={6} className="text-center py-8 text-gray-500">No hay comisiones registradas</TableCell>
                                    </TableRow>
                                ) : (
                                    commissions.map((commission: any) => (
                                        <TableRow key={commission.id}>
                                            <TableCell className="text-sm">
                                                {new Date(commission.created_at).toLocaleDateString('es-ES')}
                                            </TableCell>
                                            <TableCell className="text-sm">
                                                {commission.sale?.student?.full_name || '-'}
                                            </TableCell>
                                            <TableCell className="text-sm">
                                                {commission.sale?.pack?.name || '-'}
                                            </TableCell>
                                            <TableCell className="text-right font-semibold text-sm">
                                                {commission.amount.toFixed(2)}€
                                            </TableCell>
                                            <TableCell className="text-center whitespace-nowrap">
                                                <div className="flex flex-col items-center space-y-1">
                                                    {getStatusBadge(commission.status)}
                                                    {commission.status === 'incidence' && commission.incidence_note && (
                                                        <span className="text-[10px] text-red-500 truncate max-w-[100px]" title={commission.incidence_note}>
                                                            {commission.incidence_note}
                                                        </span>
                                                    )}
                                                </div>
                                            </TableCell>
                                            <TableCell className="text-right">
                                                <div className="flex items-center justify-end space-x-2">
                                                    {commission.status === 'pending' && (
                                                        <>
                                                            <Button
                                                                size="sm"
                                                                variant="ghost"
                                                                className="h-8 w-8 p-0 text-green-600"
                                                                onClick={() => handleValidate(commission.id)}
                                                                title="Validar"
                                                            >
                                                                <CheckCircle2 className="w-4 h-4" />
                                                            </Button>
                                                            <Button
                                                                size="sm"
                                                                variant="ghost"
                                                                className="h-8 w-8 p-0 text-red-600"
                                                                onClick={() => handleOpenIncidence(commission.id)}
                                                                title="Reportar Incidencia"
                                                            >
                                                                <AlertCircle className="w-4 h-4" />
                                                            </Button>
                                                        </>
                                                    )}
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    </div>

                    <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4 border-t pt-4">
                        <div className="bg-gray-50 p-4 rounded-lg text-center">
                            <p className="text-sm text-gray-500 mb-1">Total Generado (Este Mes)</p>
                            <p className="text-xl font-bold text-gray-900">{summary.generatedThisMonth.toFixed(2)}€</p>
                        </div>
                        <div className="bg-blue-50 p-4 rounded-lg text-center border border-blue-100">
                            <p className="text-sm text-blue-600 mb-1">Total Recibido (Pagado)</p>
                            <p className="text-xl font-bold text-blue-700">{summary.received.toFixed(2)}€</p>
                        </div>
                        <div className="bg-red-50 p-4 rounded-lg text-center border border-red-100">
                            <p className="text-sm text-red-600 mb-1">Pendiente de Cobro</p>
                            <p className="text-xl font-bold text-red-700">{summary.remaining.toFixed(2)}€</p>
                        </div>
                    </div>
                </CardContent>
            </Card>

            <Dialog open={isIncidenceOpen} onOpenChange={setIsIncidenceOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Reportar Incidencia</DialogTitle>
                        <DialogDescription>
                            Por favor, describe el motivo de la incidencia para esta comisión.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        <div className="grid gap-2">
                            <Label htmlFor="note">Nota</Label>
                            <Textarea
                                id="note"
                                value={incidenceNote}
                                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setIncidenceNote(e.target.value)}
                                placeholder="Ej: El alumno solicitó devolución..."
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsIncidenceOpen(false)}>Cancelar</Button>
                        <Button onClick={handleSubmitIncidence} variant="destructive">Reportar</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
