'use client';

import { useSearchParams } from 'next/navigation';
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
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import {
    CheckCircle2,
    AlertCircle,
    DollarSign,
    Filter,
    Download,
    XCircle,
    Search,
    User,
    Calendar,
    Users,
    ChevronLeft,
    ChevronRight,
    Pencil
} from 'lucide-react';
import { validateCommission, reportIncidence, markAsPaid, resolveIncidence, modifyAndAcceptIncidence, rejectIncidence, reassignCommissionAgent } from '@/app/actions/commissions';
import { toast } from 'sonner';

interface Commission {
    id: string;
    sale_id: string;
    agent_id: string;
    role_at_sale: string;
    agent_role: string;
    amount: number;
    status: 'pending' | 'incidence' | 'validated' | 'paid' | 'cancelled';
    milestone: number;
    created_at: string;
    validated_at?: string;
    paid_at?: string;
    incidence_note?: string;
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
        role: string;
    };
}

interface CommissionTableProps {
    userRole: 'admin' | 'closer' | 'coach' | 'setter';
    userId?: string;
}

export default function CommissionTable({ userRole, userId }: CommissionTableProps) {
    const searchParams = useSearchParams();
    const [commissions, setCommissions] = useState<Commission[]>([]);
    const [loading, setLoading] = useState(true);

    // Filters State
    const [statusFilter, setStatusFilter] = useState<string>('all');
    const [agentFilter, setAgentFilter] = useState<string>('all');
    const [selectedMonth, setSelectedMonth] = useState<string>('all');
    const [searchTerm, setSearchTerm] = useState('');

    // Incidence Dialog State
    const [isIncidenceOpen, setIsIncidenceOpen] = useState(false);
    const [selectedCommissionId, setSelectedCommissionId] = useState<string | null>(null);
    const [incidenceNote, setIncidenceNote] = useState('');

    // Management Dialog State (for Admin)
    const [isManagementOpen, setIsManagementOpen] = useState(false);
    const [managedCommission, setManagedCommission] = useState<Commission | null>(null);
    const [newAgentId, setNewAgentId] = useState('');
    const [newAmount, setNewAmount] = useState(0);
    const [agents, setAgents] = useState<Array<{ id: string; full_name: string; email: string; role: string }>>([]);
    const [agentsByRole, setAgentsByRole] = useState<Record<string, Array<{ id: string; full_name: string; email: string; role: string }>>>({});

    // Reassign Dialog State (for Admin)
    const [isReassignOpen, setIsReassignOpen] = useState(false);
    const [reassignCommission, setReassignCommission] = useState<Commission | null>(null);
    const [reassignNewAgentId, setReassignNewAgentId] = useState('');
    const [reassignLoading, setReassignLoading] = useState(false);

    // Pagination State
    const [page, setPage] = useState(1);
    const [totalCount, setTotalCount] = useState(0);
    const PAGE_SIZE = 20;

    // Server-side totals (independent of pagination)
    const [statsTotalAmount, setStatsTotalAmount] = useState(0);
    const [statsPaidAmount, setStatsPaidAmount] = useState(0);
    const [statsPendingAmount, setStatsPendingAmount] = useState(0);

    const supabase = createClient();

    // Reset page on filter change
    useEffect(() => {
        setPage(1);
    }, [statusFilter, agentFilter, selectedMonth, searchTerm]);

    // Update status filter if URL changes
    useEffect(() => {
        const paramStatus = searchParams.get('status');
        if (paramStatus) {
            setStatusFilter(paramStatus);
        }
    }, [searchParams]);

    // Load data on filter/page change
    useEffect(() => {
        loadCommissions();
        loadTotals(); // always recalculate totals independently
    }, [page, userRole, userId, statusFilter, agentFilter, selectedMonth]);

    // Fetch agents for management dialog and filter
    useEffect(() => {
        if (userRole === 'admin') {
            const fetchAgents = async () => {
                const { data } = await supabase
                    .from('profiles')
                    .select('id, full_name, email, role')
                    .in('role', ['coach', 'closer', 'setter'])
                    .eq('is_active', true)
                    .order('full_name');
                if (data) {
                    type AgentProfile = { id: string; full_name: string; email: string; role: string };
                    const typedData = data as AgentProfile[];
                    setAgents(typedData);
                    // Group by role for filtered selectors
                    const grouped: Record<string, AgentProfile[]> = {};
                    for (const agent of typedData) {
                        if (!grouped[agent.role]) grouped[agent.role] = [];
                        grouped[agent.role].push(agent);
                    }
                    setAgentsByRole(grouped);
                }
            };
            fetchAgents();
        }
    }, [userRole]);

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
          agent:profiles!agent_id(full_name, email, role)
        `, { count: 'exact' })
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

            // Filtro de Mes
            if (selectedMonth !== 'all') {
                const [year, month] = selectedMonth.split('-');
                const startDate = new Date(parseInt(year), parseInt(month) - 1, 1).toISOString();
                const endDate = new Date(parseInt(year), parseInt(month), 0, 23, 59, 59).toISOString(); // Last day of month
                query = query.gte('created_at', startDate).lte('created_at', endDate);
            }

            // Pagination
            const from = (page - 1) * PAGE_SIZE;
            const to = from + PAGE_SIZE - 1;
            query = query.range(from, to);

            const { data, error, count } = await query;

            if (error) throw error;

            setCommissions(data || []);
            setTotalCount(count || 0);
        } catch (error) {
            console.error('Error cargando comisiones:', error);
            toast.error('Error al cargar las comisiones');
        } finally {
            setLoading(false);
        }
    };

    // Separate unpaginated query to get accurate totals for the current filters
    const loadTotals = async () => {
        try {
            let query = supabase
                .from('commissions')
                .select('amount, status');

            if (userRole !== 'admin' && userId) {
                query = query.eq('agent_id', userId);
            }
            if (statusFilter !== 'all') {
                query = query.eq('status', statusFilter);
            }
            if (userRole === 'admin' && agentFilter !== 'all') {
                query = query.eq('agent_id', agentFilter);
            }
            if (selectedMonth !== 'all') {
                const [year, month] = selectedMonth.split('-');
                const startDate = new Date(parseInt(year), parseInt(month) - 1, 1).toISOString();
                const endDate = new Date(parseInt(year), parseInt(month), 0, 23, 59, 59).toISOString();
                query = query.gte('created_at', startDate).lte('created_at', endDate);
            }

            const { data } = await query;
            if (data) {
                const all = data as { amount: number; status: string }[];
                setStatsTotalAmount(all.reduce((s, c) => s + Number(c.amount), 0));
                setStatsPaidAmount(all.filter(c => c.status === 'paid').reduce((s, c) => s + Number(c.amount), 0));
                setStatsPendingAmount(all.filter(c => ['pending', 'validated', 'incidence'].includes(c.status)).reduce((s, c) => s + Number(c.amount), 0));
            }
        } catch (err) {
            console.error('Error loading commission totals:', err);
        }
    };

    const handleValidate = async (id: string) => {
        try {
            const result = await validateCommission(id);
            if (result.error) {
                toast.error(result.error);
                return;
            }
            toast.success('Comisión validada correctamente');
            loadCommissions();
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
            loadCommissions();
        } catch (error) {
            toast.error('Error al reportar incidencia');
        }
    };

    const handlePay = async (id: string) => {
        try {
            const result = await markAsPaid(id);
            if (result.error) {
                toast.error(result.error);
                return;
            }
            toast.success('Comisión marcada como pagada');
            loadCommissions();
        } catch (error) {
            toast.error('Error al pagar');
        }
    };

    const handleResolveIncidence = async (id: string) => {
        try {
            const result = await resolveIncidence(id);
            if (result.error) {
                toast.error(result.error);
                return;
            }
            toast.success('Incidencia resuelta');
            loadCommissions();
        } catch (error) {
            toast.error('Error al resolver');
        }
    };

    const handleOpenManagement = (commission: Commission) => {
        setManagedCommission(commission);
        setNewAgentId(commission.agent_id);
        setNewAmount(commission.amount);
        setIsManagementOpen(true);
    };

    const handleOpenReassign = (commission: Commission) => {
        setReassignCommission(commission);
        setReassignNewAgentId(commission.agent_id);
        setIsReassignOpen(true);
    };

    const handleConfirmReassign = async () => {
        if (!reassignCommission || !reassignNewAgentId) return;
        if (reassignNewAgentId === reassignCommission.agent_id) {
            return;
        }
        setReassignLoading(true);
        try {
            const result = await reassignCommissionAgent(reassignCommission.id, reassignNewAgentId);
            if (!result) {
                toast.error('Error al reasignar el agente');
                return;
            }
            if (result.error) {
                toast.error(result.error);
                return;
            }
            toast.success(
                result.saleUpdated
                    ? 'Agente reasignado. La venta también se actualizó para futuros plazos.'
                    : 'Agente reasignado correctamente.'
            );
            setIsReassignOpen(false);
            loadCommissions();
        } catch {
            toast.error('Error al reasignar el agente');
        } finally {
            setReassignLoading(false);
        }
    };

    const handleModifyAndAccept = async () => {
        if (!managedCommission) return;

        try {
            const result = await modifyAndAcceptIncidence(
                managedCommission.id,
                newAgentId,
                newAmount
            );
            if (result.error) {
                toast.error(result.error);
                return;
            }
            toast.success('Comisión modificada y aceptada');
            setIsManagementOpen(false);
            loadCommissions();
        } catch (error) {
            toast.error('Error al modificar');
        }
    };

    const handleReject = async () => {
        if (!managedCommission) return;

        try {
            const result = await rejectIncidence(managedCommission.id);
            if (result.error) {
                toast.error(result.error);
                return;
            }
            toast.success('Incidencia rechazada');
            setIsManagementOpen(false);
            loadCommissions();
        } catch (error) {
            toast.error('Error al rechazar');
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
                {labels[status as keyof typeof labels]}
            </span>
        );
    };

    const filteredCommissions = commissions;

    // Stats now come from server-side totals (see loadTotals)
    const totalAmount = statsTotalAmount;
    const paidAmount = statsPaidAmount;
    const pendingAmount = statsPendingAmount;

    // Generate last 12 months for filter
    const availableMonths = Array.from({ length: 12 }, (_, i) => {
        const d = new Date();
        d.setMonth(d.getMonth() - i);
        d.setDate(1); // Avoid month edge case issues
        const key = `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, '0')}`;
        const label = d.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' });
        return { key, label };
    });

    return (
        <>
            <Card className="w-full">
                <CardHeader>
                    <div className="flex items-center justify-between">
                        <CardTitle className="flex items-center space-x-2">
                            <DollarSign className="w-5 h-5" />
                            <span>Comisiones</span>
                        </CardTitle>
                        {userRole === 'admin' && (
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
                        )}
                    </div>
                </CardHeader>
                <CardContent>
                    {userRole !== 'admin' && (
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                            <div className="bg-gray-50 p-4 rounded-lg text-center border border-gray-200">
                                <p className="text-sm text-gray-500 mb-1">Total Generado</p>
                                <p className="text-xl font-bold text-gray-900">{totalAmount.toFixed(2)}€</p>
                            </div>
                            <div className="bg-blue-50 p-4 rounded-lg text-center border border-blue-100">
                                <p className="text-sm text-blue-600 mb-1">Total Recibido (Pagado)</p>
                                <p className="text-xl font-bold text-blue-700">{paidAmount.toFixed(2)}€</p>
                            </div>
                            <div className="bg-red-50 p-4 rounded-lg text-center border border-red-100">
                                <p className="text-sm text-red-600 mb-1">Pendiente de Cobro</p>
                                <p className="text-xl font-bold text-red-700">{pendingAmount.toFixed(2)}€</p>
                            </div>
                        </div>
                    )}

                    {/* Filtros Row */}
                    <div className="flex flex-col md:flex-row gap-4 mb-6 justify-between items-start md:items-center bg-gray-50/50 p-4 rounded-lg border border-gray-100">
                        <div className="flex flex-wrap gap-4 w-full md:w-auto">
                            {/* Period Filter */}
                            <div className="flex items-center gap-2">
                                <Calendar className="w-4 h-4 text-gray-500" />
                                <select
                                    value={selectedMonth}
                                    onChange={(e) => setSelectedMonth(e.target.value)}
                                    className="h-9 rounded-md border text-sm bg-white px-2 py-1 max-w-[160px] focus:ring-2 focus:ring-slate-200 focus:border-slate-400 outline-none"
                                >
                                    <option value="all">Todo el periodo</option>
                                    {availableMonths.map(month => (
                                        <option key={month.key} value={month.key}>
                                            {month.label}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            {/* Agent Filter (Admin Only) */}
                            {userRole === 'admin' && (
                                <div className="flex items-center gap-2">
                                    <Users className="w-4 h-4 text-gray-500" />
                                    <select
                                        value={agentFilter}
                                        onChange={(e) => setAgentFilter(e.target.value)}
                                        className="h-9 rounded-md border text-sm bg-white px-2 py-1 max-w-[160px] focus:ring-2 focus:ring-slate-200 focus:border-slate-400 outline-none"
                                    >
                                        <option value="all">Todos los agentes</option>
                                        {agents.map(agent => (
                                            <option key={agent.id} value={agent.id}>
                                                {agent.full_name}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            )}

                            {/* Status Filter */}
                            <div className="flex items-center gap-2">
                                <Filter className="w-4 h-4 text-gray-500" />
                                <select
                                    value={statusFilter}
                                    onChange={(e) => setStatusFilter(e.target.value)}
                                    className="h-9 rounded-md border text-sm bg-white px-2 py-1 max-w-[160px] focus:ring-2 focus:ring-slate-200 focus:border-slate-400 outline-none"
                                >
                                    <option value="all">Todos los estados</option>
                                    <option value="pending">Pendiente</option>
                                    <option value="validated">Validado</option>
                                    <option value="paid">Pagado</option>
                                    <option value="incidence">Incidencia</option>
                                    <option value="cancelled">Cancelado</option>
                                </select>
                            </div>
                        </div>

                        {/* Search */}
                        <div className="relative w-full md:w-64">
                            <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                            <Input
                                placeholder="Buscar alumno, email..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="pl-9 h-9 bg-white"
                            />
                        </div>
                    </div>

                    {/* Tabla */}
                    {loading ? (
                        <div className="text-center py-8 text-gray-500">Cargando comisiones...</div>
                    ) : filteredCommissions.length === 0 ? (
                        <div className="text-center py-8 text-gray-500">No se encontraron comisiones con estos filtros</div>
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
                                    {filteredCommissions.map((commission) => (
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
                                                            {commission.agent?.role || commission.agent_role}
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
                                                <div className="flex flex-col space-y-1">
                                                    {getStatusBadge(commission.status)}
                                                    {commission.status === 'incidence' && commission.incidence_note && (
                                                        <span className="text-xs text-red-500 truncate max-w-[150px]" title={commission.incidence_note}>
                                                            {commission.incidence_note}
                                                        </span>
                                                    )}
                                                </div>
                                            </TableCell>

                                            <TableCell className="text-right">
                                                <div className="flex items-center justify-end space-x-2">
                                                    {/* Acciones para Agentes (Pending -> Validated / Incidence) */}
                                                    {userRole !== 'admin' && commission.status === 'pending' && (
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

                                                    {/* Acciones para Admin (Validated -> Paid) */}
                                                    {userRole === 'admin' && commission.status === 'validated' && (
                                                        <Button
                                                            size="sm"
                                                            className="h-8 px-2 text-xs"
                                                            onClick={() => handlePay(commission.id)}
                                                        >
                                                            <DollarSign className="w-3 h-3 mr-1" />
                                                            Pagar
                                                        </Button>
                                                    )}



                                                    {/* Acciones para Admin (Incidence -> Gestionar) */}
                                                    {userRole === 'admin' && commission.status === 'incidence' && (
                                                        <Button
                                                            size="sm"
                                                            variant="outline"
                                                            className="h-8 px-2 text-xs border-blue-200 text-blue-700 hover:bg-blue-50"
                                                            onClick={() => handleOpenManagement(commission)}
                                                        >
                                                            Gestionar
                                                        </Button>
                                                    )}

                                                    {/* Reasignar Agente (Admin, solo pending o validated) */}
                                                    {userRole === 'admin' && ['pending', 'validated'].includes(commission.status) && (
                                                        <Button
                                                            size="sm"
                                                            variant="ghost"
                                                            className="h-8 w-8 p-0 text-gray-500 hover:text-indigo-600 hover:bg-indigo-50"
                                                            onClick={() => handleOpenReassign(commission)}
                                                            title="Reasignar agente"
                                                        >
                                                            <Pencil className="w-4 h-4" />
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
                    {/* Paginación */}
                    <div className="flex items-center justify-between mt-4 border-t pt-4">
                        <div className="text-sm text-gray-500">
                            Mostrando {((page - 1) * PAGE_SIZE) + 1} a {Math.min(page * PAGE_SIZE, totalCount)} de {totalCount} resultados
                        </div>
                        <div className="flex items-center space-x-2">
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setPage(p => Math.max(1, p - 1))}
                                disabled={page === 1 || loading}
                            >
                                <ChevronLeft className="h-4 w-4" />
                                Anterior
                            </Button>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setPage(p => p + 1)}
                                disabled={page * PAGE_SIZE >= totalCount || loading}
                            >
                                Siguiente
                                <ChevronRight className="h-4 w-4" />
                            </Button>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Reassign Agent Dialog */}
            <Dialog open={isReassignOpen} onOpenChange={setIsReassignOpen}>
                <DialogContent className="sm:max-w-[480px]">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <Pencil className="w-4 h-4" />
                            Reasignar Agente
                        </DialogTitle>
                        <DialogDescription>
                            Cambia el agente asignado a esta comisión. Solo se muestran agentes del mismo rol.
                        </DialogDescription>
                    </DialogHeader>
                    {reassignCommission && (
                        <div className="grid gap-4 py-4">
                            {/* Info display */}
                            <div className="grid grid-cols-2 gap-2 text-sm p-3 bg-gray-50 rounded-md border">
                                <div><span className="text-gray-500">Alumno:</span> <span className="font-medium">{reassignCommission.sale?.student?.full_name || reassignCommission.sale?.student?.email || '-'}</span></div>
                                <div><span className="text-gray-500">Pack:</span> <span className="font-medium">{reassignCommission.sale?.pack?.name || '-'}</span></div>
                                <div><span className="text-gray-500">Rol:</span> <span className="font-medium capitalize">{reassignCommission.agent?.role || '-'}</span></div>
                                <div><span className="text-gray-500">Importe:</span> <span className="font-semibold text-green-700">{reassignCommission.amount.toFixed(2)}€</span></div>
                                <div className="col-span-2"><span className="text-gray-500">Agente actual:</span> <span className="font-medium">{reassignCommission.agent?.full_name || reassignCommission.agent?.email || '-'}</span></div>
                            </div>

                            {/* Agent selector filtered by role */}
                            <div className="grid gap-2">
                                <Label htmlFor="reassign-agent">Nuevo Agente</Label>
                                <select
                                    id="reassign-agent"
                                    value={reassignNewAgentId}
                                    onChange={(e) => setReassignNewAgentId(e.target.value)}
                                    className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                                >
                                    <option value="">-- Selecciona un agente --</option>
                                    {(agentsByRole[reassignCommission.role_at_sale || reassignCommission.agent?.role || ''] ?? []).map(agent => (
                                        <option key={agent.id} value={agent.id} disabled={agent.id === reassignCommission.agent_id}>
                                            {agent.full_name} ({agent.email}){agent.id === reassignCommission.agent_id ? ' — actual' : ''}
                                        </option>
                                    ))}
                                    {(agentsByRole[reassignCommission.role_at_sale || reassignCommission.agent?.role || ''] ?? []).length === 0 && (
                                        <option disabled>No hay agentes disponibles para este rol</option>
                                    )}
                                </select>
                            </div>

                            {/* Info notice */}
                            <div className="flex items-start gap-2 p-3 bg-blue-50 border border-blue-200 rounded-md text-sm text-blue-800">
                                <AlertCircle className="w-4 h-4 mt-0.5 shrink-0 text-blue-500" />
                                <span>La venta también se actualizará para que los <strong>plazos futuros</strong> de este pack se asignen al nuevo agente.</span>
                            </div>
                        </div>
                    )}
                    <DialogFooter className="gap-2">
                        <Button variant="outline" onClick={() => setIsReassignOpen(false)} disabled={reassignLoading}>
                            Cancelar
                        </Button>
                        <Button
                            onClick={handleConfirmReassign}
                            disabled={reassignLoading || !reassignNewAgentId || reassignNewAgentId === reassignCommission?.agent_id}
                            className="bg-indigo-600 hover:bg-indigo-700"
                        >
                            {reassignLoading ? 'Guardando...' : 'Guardar Reasignación'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

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

            {/* Management Dialog for Admin */}
            <Dialog open={isManagementOpen} onOpenChange={setIsManagementOpen}>
                <DialogContent className="sm:max-w-[500px]">
                    <DialogHeader>
                        <DialogTitle>Gestionar Incidencia</DialogTitle>
                        <DialogDescription>
                            Modifica los datos de la comisión y acepta o rechaza la incidencia reported by the agent.
                        </DialogDescription>
                    </DialogHeader>
                    {managedCommission && (
                        <>
                            <div className="grid gap-4 py-4">
                                {/* Incidence Note Display */}
                                {managedCommission.incidence_note && (
                                    <div className="p-3 bg-red-50 border border-red-200 rounded-md">
                                        <p className="text-sm font-semibold text-red-900 mb-1">Nota de Incidencia:</p>
                                        <p className="text-sm text-red-700">{managedCommission.incidence_note}</p>
                                    </div>
                                )}

                                {/* Agent Selector */}
                                <div className="grid gap-2">
                                    <Label htmlFor="agent">Agente</Label>
                                    <select
                                        id="agent"
                                        value={newAgentId}
                                        onChange={(e) => setNewAgentId(e.target.value)}
                                        className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                                    >
                                        {agents.map(agent => (
                                            <option key={agent.id} value={agent.id}>
                                                {agent.full_name} ({agent.email})
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                {/* Amount Input */}
                                <div className="grid gap-2">
                                    <Label htmlFor="amount">Importe (€)</Label>
                                    <input
                                        id="amount"
                                        type="number"
                                        step="0.01"
                                        value={newAmount}
                                        onChange={(e) => setNewAmount(parseFloat(e.target.value))}
                                        className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                                    />
                                </div>
                            </div>
                            <DialogFooter className="gap-2">
                                <Button
                                    variant="destructive"
                                    onClick={handleReject}
                                    className="flex-1"
                                >
                                    <XCircle className="w-4 h-4 mr-2" />
                                    Rechazar
                                </Button>
                                <Button
                                    variant="default"
                                    onClick={handleModifyAndAccept}
                                    className="flex-1 bg-green-600 hover:bg-green-700"
                                >
                                    <CheckCircle2 className="w-4 h-4 mr-2" />
                                    Aceptar
                                </Button>
                            </DialogFooter>
                        </>
                    )}
                </DialogContent>
            </Dialog>
        </>
    );
}
