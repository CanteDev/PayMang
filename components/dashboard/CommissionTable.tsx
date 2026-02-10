'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
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
import {
    CheckCircle2,
    AlertCircle,
    DollarSign,
    Filter,
    Download
} from 'lucide-react';

interface Commission {
    id: string;
    sale_id: string;
    agent_id: string;
    agent_role: string;
    amount: number;
    status: 'pending' | 'incidence' | 'validated' | 'paid';
    milestone: number;
    created_at: string;
    sale?: {
        id: string;
        amount: number;
        gateway: string;
        created_at: string;
        pack?: {
            name: string;
        };
        student?: {
            email: string;
            full_name: string;
        };
    };
    agent?: {
        full_name: string;
        email: string;
    };
}

interface CommissionTableProps {
    userRole: 'admin' | 'closer' | 'coach' | 'setter';
    userId?: string;
}

export default function CommissionTable({ userRole, userId }: CommissionTableProps) {
    const [commissions, setCommissions] = useState<Commission[]>([]);
    const [loading, setLoading] = useState(true);
    const [statusFilter, setStatusFilter] = useState<string>('all');
    const [agentFilter, setAgentFilter] = useState<string>('all');

    const supabase = createClient();

    useEffect(() => {
        loadCommissions();
    }, [userRole, userId, statusFilter, agentFilter]);

    const loadCommissions = async () => {
        setLoading(true);

        try {
            let query = supabase
                .from('commissions')
                .select(`
          *,
          sale:sales(
            *,
            pack:packs(name),
            student:students(email, full_name)
          ),
          agent:profiles!agent_id(full_name, email)
        `)
                .order('created_at', { ascending: false });

            // Filtrar según rol
            if (userRole !== 'admin' && userId) {
                query = query.eq('agent_id', userId);
            }

            // Filtro de estado
            if (statusFilter !== 'all') {
                query = query.eq('status', statusFilter);
            }

            // Filtro de agente (solo para admin)
            if (userRole === 'admin' && agentFilter !== 'all') {
                query = query.eq('agent_id', agentFilter);
            }

            const { data, error } = await query;

            if (error) throw error;

            setCommissions(data || []);
        } catch (error) {
            console.error('Error cargando comisiones:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleUpdateStatus = async (commissionId: string, newStatus: string) => {
        try {
            const { error } = await supabase
                .from('commissions')
                .update({ status: newStatus })
                .eq('id', commissionId);

            if (error) throw error;

            // Recargar comisiones
            loadCommissions();
        } catch (error) {
            console.error('Error actualizando comisión:', error);
        }
    };

    const getStatusBadge = (status: string) => {
        const styles = {
            pending: 'bg-blue-100 text-blue-700 border-blue-200',
            incidence: 'bg-red-100 text-red-700 border-red-200',
            validated: 'bg-blue-100 text-blue-700 border-blue-200',
            paid: 'bg-green-100 text-green-700 border-green-200',
        };

        const labels = {
            pending: 'Pendiente',
            incidence: 'Incidencia',
            validated: 'Validado',
            paid: 'Pagado',
        };

        return (
            <span className={`px-2 py-1 rounded-md text-xs font-medium border ${styles[status as keyof typeof styles]}`}>
                {labels[status as keyof typeof labels]}
            </span>
        );
    };

    const canValidate = (commission: Commission) => {
        return userRole === 'coach' &&
            commission.agent_role === 'coach' &&
            commission.status === 'pending';
    };

    const canMarkAsPaid = (commission: Commission) => {
        return userRole === 'admin' && commission.status === 'validated';
    };

    const canMarkAsIncidence = (commission: Commission) => {
        return userRole === 'admin' && commission.status === 'pending';
    };

    // Calcular total de comisiones visibles
    const totalAmount = commissions.reduce((sum, c) => sum + c.amount, 0);
    const pendingAmount = commissions
        .filter(c => c.status === 'pending')
        .reduce((sum, c) => sum + c.amount, 0);

    return (
        <Card className="w-full">
            <CardHeader>
                <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center space-x-2">
                        <DollarSign className="w-5 h-5" />
                        <span>Comisiones</span>
                    </CardTitle>
                    <div className="flex items-center space-x-4">
                        <div className="text-sm">
                            <span className="text-gray-600">Total: </span>
                            <span className="font-semibold">{totalAmount.toFixed(2)}€</span>
                        </div>
                        <div className="text-sm">
                            <span className="text-gray-600">Pendiente: </span>
                            <span className="font-semibold text-blue-600">{pendingAmount.toFixed(2)}€</span>
                        </div>
                    </div>
                </div>
            </CardHeader>
            <CardContent>
                {/* Filtros */}
                <div className="flex items-center space-x-4 mb-6">
                    <div className="flex items-center space-x-2">
                        <Filter className="w-4 h-4 text-gray-500" />
                        <select
                            value={statusFilter}
                            onChange={(e) => setStatusFilter(e.target.value)}
                            className="h-9 px-3 rounded-lg border border-gray-300 bg-white text-sm"
                        >
                            <option value="all">Todos los estados</option>
                            <option value="pending">Pendiente</option>
                            <option value="validated">Validado</option>
                            <option value="paid">Pagado</option>
                            <option value="incidence">Incidencia</option>
                        </select>
                    </div>
                </div>

                {/* Tabla */}
                {loading ? (
                    <div className="text-center py-8 text-gray-500">Cargando comisiones...</div>
                ) : commissions.length === 0 ? (
                    <div className="text-center py-8 text-gray-500">No hay comisiones disponibles</div>
                ) : (
                    <div className="border rounded-lg overflow-hidden">
                        <Table>
                            <TableHeader>
                                <TableRow className="bg-gray-50">
                                    <TableHead>Fecha</TableHead>
                                    {userRole === 'admin' && <TableHead>Agente</TableHead>}
                                    {userRole === 'admin' && <TableHead>Rol</TableHead>}
                                    {userRole !== 'setter' && <TableHead>Estudiante</TableHead>}
                                    <TableHead>Pack</TableHead>
                                    <TableHead>Pasarela</TableHead>
                                    <TableHead className="text-right">Monto</TableHead>
                                    <TableHead>Estado</TableHead>
                                    <TableHead className="text-right">Acciones</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {commissions.map((commission) => (
                                    <TableRow key={commission.id}>
                                        <TableCell className="text-sm">
                                            {new Date(commission.created_at).toLocaleDateString('es-ES')}
                                        </TableCell>

                                        {userRole === 'admin' && (
                                            <>
                                                <TableCell className="text-sm">
                                                    {commission.agent?.full_name || commission.agent?.email}
                                                </TableCell>
                                                <TableCell>
                                                    <span className="text-xs px-2 py-1 rounded-md bg-gray-100 text-gray-700 capitalize">
                                                        {commission.agent_role}
                                                    </span>
                                                </TableCell>
                                            </>
                                        )}

                                        {userRole !== 'setter' && (
                                            <TableCell className="text-sm">
                                                {commission.sale?.student?.full_name || commission.sale?.student?.email || '-'}
                                            </TableCell>
                                        )}

                                        <TableCell className="text-sm">
                                            {commission.sale?.pack?.name || '-'}
                                        </TableCell>

                                        <TableCell>
                                            <span className="text-xs px-2 py-1 rounded-md bg-gray-100 text-gray-700 capitalize">
                                                {commission.sale?.gateway || '-'}
                                            </span>
                                        </TableCell>

                                        <TableCell className="text-right text-sm font-semibold">
                                            {commission.amount.toFixed(2)}€
                                        </TableCell>

                                        <TableCell>
                                            {getStatusBadge(commission.status)}
                                        </TableCell>

                                        <TableCell className="text-right">
                                            <div className="flex items-center justify-end space-x-2">
                                                {canValidate(commission) && (
                                                    <Button
                                                        size="sm"
                                                        variant="secondary"
                                                        onClick={() => handleUpdateStatus(commission.id, 'validated')}
                                                    >
                                                        <CheckCircle2 className="w-4 h-4 mr-1" />
                                                        Validar
                                                    </Button>
                                                )}

                                                {canMarkAsPaid(commission) && (
                                                    <Button
                                                        size="sm"
                                                        onClick={() => handleUpdateStatus(commission.id, 'paid')}
                                                    >
                                                        <CheckCircle2 className="w-4 h-4 mr-1" />
                                                        Marcar Pagado
                                                    </Button>
                                                )}

                                                {canMarkAsIncidence(commission) && (
                                                    <Button
                                                        size="sm"
                                                        variant="secondary"
                                                        onClick={() => handleUpdateStatus(commission.id, 'incidence')}
                                                    >
                                                        <AlertCircle className="w-4 h-4 mr-1" />
                                                        Incidencia
                                                    </Button>
                                                )}
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
