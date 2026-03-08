'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Users, Search, User, Filter, Calendar, Edit2 } from 'lucide-react';
import StudentForm from '@/components/admin/StudentForm';
import StudentPaymentDetails from '@/components/admin/StudentPaymentDetails';
import { MultiSelect } from '@/components/ui/MultiSelect';

interface Student {
    id: string;
    email: string;
    full_name: string;
    phone: string | null;
    status: string;
    assigned_coach_id: string | null;
    closer_id: string | null;
    setter_id: string | null;
    coach?: {
        full_name: string;
    };
    created_at: string;
    // Payment info
    payments?: {
        amount: number;
        status: string;
        due_date: string;
    }[];
    sales?: {
        total_amount: number;
        status: string;
        gateway: string;
        amount_collected?: number;
    }[];
}

export default function AdminStudentsPage() {
    const [students, setStudents] = useState<Student[]>([]);
    const [coaches, setCoaches] = useState<{ id: string, full_name: string }[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Filters
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedMonth, setSelectedMonth] = useState<string>('all');
    const [statusFilter, setStatusFilter] = useState<string[]>([]);
    const [coachFilter, setCoachFilter] = useState<string[]>([]);
    const [morosoFilter, setMorosoFilter] = useState<boolean>(false);

    const supabase = createClient();

    useEffect(() => {
        loadCoaches();
    }, []);

    useEffect(() => {
        loadStudents();
    }, [selectedMonth, statusFilter, coachFilter]);

    const loadCoaches = async () => {
        const { data } = await supabase
            .from('profiles')
            .select('id, full_name')
            .eq('role', 'coach')
            .eq('is_active', true)
            .order('full_name');
        setCoaches(data || []);
    };

    const loadStudents = async () => {
        setLoading(true);
        setError(null);
        try {
            let query = supabase
                .from('students')
                .select(`
                    *,
                    coach:profiles!assigned_coach_id(full_name),
                    payments(amount, status, due_date),
                    sales(total_amount, status, gateway, amount_collected)
                `)
                .order('created_at', { ascending: false });

            // Date Filter (Registration Month)
            if (selectedMonth !== 'all') {
                const [year, month] = selectedMonth.split('-');
                const startDate = new Date(parseInt(year), parseInt(month) - 1, 1).toISOString();
                const endDate = new Date(parseInt(year), parseInt(month), 0, 23, 59, 59).toISOString();
                query = query.gte('created_at', startDate).lte('created_at', endDate);
            }

            // Status Filter
            if (statusFilter.length > 0) {
                query = query.in('status', statusFilter);
            }

            // Coach Filter
            if (coachFilter.length > 0) {
                const hasUnassigned = coachFilter.includes('unassigned');
                const coachIds = coachFilter.filter(id => id !== 'unassigned');

                if (hasUnassigned && coachIds.length > 0) {
                    query = query.or(`assigned_coach_id.in.(${coachIds.join(',')}),assigned_coach_id.is.null`);
                } else if (hasUnassigned) {
                    query = query.is('assigned_coach_id', null);
                } else {
                    query = query.in('assigned_coach_id', coachIds);
                }
            }

            const { data, error: fetchError } = await query;

            if (fetchError) throw fetchError;
            setStudents(data as any || []);
        } catch (err: any) {
            console.error('Error loading students:', err);
            setError(err.message || 'Error al cargar alumnos');
        } finally {
            setLoading(false);
        }
    };

    // Client-side search and moroso filter
    const filteredStudents = students.filter(student => {
        const matchesSearch = (
            student.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            student.email?.toLowerCase().includes(searchTerm.toLowerCase())
        );

        // +1 day grace: only overdue if due_date < yesterday (start of day)
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        yesterday.setHours(0, 0, 0, 0);

        // Get total agreed across all sales
        const totalAgreed = student.sales?.reduce((sum, s) => sum + (s.total_amount || 0), 0) || 0;

        // Get total collected via gateway sales
        const gatewaySalesTotal = student.sales
            ?.filter(s => s.status === 'paid')
            .reduce((sum, s) => sum + (s.total_amount || 0), 0) || 0;

        // A student is not overdue if gateway sales already cover full price
        const fullyPaidViaGateway = totalAgreed > 0 && gatewaySalesTotal >= totalAgreed;

        const isOverdue = !fullyPaidViaGateway && student.payments?.some(p =>
            p.status === 'pending' && new Date(p.due_date) < yesterday
        );

        if (morosoFilter && !isOverdue) return false;
        return matchesSearch;
    });

    const getPaymentProgress = (student: Student) => {
        const totalAgreed = student.sales?.reduce((sum, s) => sum + (s.total_amount || 0), 0) || 0;
        if (totalAgreed === 0) return { paid: 0, total: 0, percentage: 0 };

        // The single source of truth for paid amounts is now `amount_collected` on the sale,
        // which gets updated by webhooks (Hotmart, Stripe), simulator, and manual payments (`registerPayment`).
        const amountCollected = student.sales?.reduce((sum, s) => sum + Number(s.amount_collected || 0), 0) || 0;

        let paid = Number(Math.min(amountCollected, totalAgreed).toFixed(2));
        const total = Number(totalAgreed.toFixed(2));

        // Auto-correct 1-5 cent divisional variances
        if (total > 0 && Math.abs(total - paid) <= 0.05) {
            paid = total;
        }

        const percentage = Math.min(100, Math.round((paid / total) * 100));
        return { paid, total, percentage };
    };

    const getStatusBadge = (status: string) => {
        const styles = {
            active: 'bg-green-100 text-green-700',
            inactive: 'bg-gray-100 text-gray-700',
            paused: 'bg-yellow-100 text-yellow-700',
            finished: 'bg-blue-100 text-blue-700',
            defaulted: 'bg-red-100 text-red-700',
        };
        const labels = {
            active: 'Activo',
            inactive: 'Inactivo',
            paused: 'Pausado',
            finished: 'Finalizado',
            defaulted: 'Impago',
        };
        return (
            <span className={`px-2 py-1 rounded-md text-xs font-medium ${styles[status as keyof typeof styles] || 'bg-gray-100 text-gray-700'}`}>
                {labels[status as keyof typeof labels] || status}
            </span>
        );
    };

    // Generate last 12 months for filter
    const availableMonths = Array.from({ length: 12 }, (_, i) => {
        const d = new Date();
        d.setMonth(d.getMonth() - i);
        d.setDate(1);
        const key = `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, '0')}`;
        const label = d.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' });
        return { key, label };
    });

            const updateSingleStudent = async (studentId: string) => {
                const { data, error } = await supabase
                    .from('students')
                    .select(`
                        *,
                        coach:profiles!assigned_coach_id(full_name),
                        payments(amount, status, due_date),
                        sales(total_amount, status, gateway, amount_collected)
                    `)
                    .eq('id', studentId)
                    .single();

                if (data && !error) {
                    setStudents(prev => prev.map(s => s.id === studentId ? data as any : s));
                }
            };
            
            return (
                <div className="space-y-6">
                    <div>
                        <h1 className="text-3xl font-semibold text-gray-900">Alumnos</h1>
                        <p className="text-gray-600 mt-1">Gestión de estudiantes y asignaciones</p>
                    </div>

                    <Card>
                        <CardHeader>
                            <div className="flex items-center justify-between">
                                <CardTitle className="flex items-center space-x-2">
                                    <Users className="w-5 h-5" />
                                    <span>Listado de Alumnos</span>
                                </CardTitle>
                                <StudentForm onSuccess={loadStudents} />
                            </div>
                        </CardHeader>
                        <CardContent>
                            {/* Filters Row */}
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

                                    {/* Coach Filter */}
                                    <div className="flex items-center gap-2 w-full md:w-[200px]">
                                        <MultiSelect
                                            options={[
                                                { label: 'Sin asignar', value: 'unassigned' },
                                                ...coaches.map(c => ({ label: c.full_name, value: c.id }))
                                            ]}
                                            selected={coachFilter}
                                            onChange={setCoachFilter}
                                            placeholder="Todos los coaches"
                                            icon={<User className="w-4 h-4" />}
                                        />
                                    </div>

                                    {/* Status Filter */}
                                    <div className="flex items-center gap-2 w-full md:w-[180px]">
                                        <MultiSelect
                                            options={[
                                                { label: 'Activo', value: 'active' },
                                                { label: 'Inactivo', value: 'inactive' },
                                                { label: 'Pausado', value: 'paused' },
                                                { label: 'Finalizado', value: 'finished' },
                                                { label: 'Impago', value: 'defaulted' }
                                            ]}
                                            selected={statusFilter}
                                            onChange={setStatusFilter}
                                            placeholder="Todos los estados"
                                            icon={<Filter className="w-4 h-4" />}
                                        />
                                    </div>

                                    {/* Moroso Filter */}
                                    <div className="flex items-center gap-2">
                                        <Button
                                            variant={morosoFilter ? 'destructive' : 'outline'}
                                            size="sm"
                                            className="h-9"
                                            onClick={() => setMorosoFilter(!morosoFilter)}
                                        >
                                            Morosos
                                        </Button>
                                    </div>
                                </div>

                                {/* Search */}
                                <div className="relative w-full md:w-64">
                                    <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                                    <Input
                                        placeholder="Buscar por nombre o email..."
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                        className="pl-9 h-9 bg-white"
                                    />
                                </div>
                            </div>
                            {/* Error Display */}
                            {error && (
                                <div className="mb-6 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm flex justify-between items-center">
                                    <span>{error}</span>
                                    <Button variant="ghost" size="sm" onClick={() => loadStudents()} className="h-8 hover:bg-red-100">
                                        Reintentar
                                    </Button>
                                </div>
                            )}

                            {/* Table */}
                            {loading ? (
                                <div className="text-center py-10">Cargando...</div>
                            ) : (
                                <div className="border rounded-lg overflow-hidden">
                                    <Table>
                                        <TableHeader>
                                            <TableRow className="bg-gray-50">
                                                <TableHead>Nombre</TableHead>
                                                <TableHead>Email</TableHead>
                                                <TableHead>Coach</TableHead>
                                                <TableHead>Progreso Pago</TableHead>
                                                <TableHead>Estado</TableHead>
                                                <TableHead className="text-right">Acciones</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {filteredStudents.length === 0 ? (
                                                <TableRow>
                                                    <TableCell colSpan={6} className="text-center py-8 text-gray-500">
                                                        No se encontraron alumnos con estos filtros
                                                    </TableCell>
                                                </TableRow>
                                            ) : (
                                                filteredStudents.map((student) => {
                                                    const progress = getPaymentProgress(student);
                                                    const yesterday = new Date();
                                                    yesterday.setDate(yesterday.getDate() - 1);
                                                    yesterday.setHours(0, 0, 0, 0);
                                                    const totalAgreed = student.sales?.reduce((sum, s) => sum + (s.total_amount || 0), 0) || 0;
                                                    const gatewaySalesTotal = student.sales?.filter(s => s.status === 'paid').reduce((sum, s) => sum + (s.total_amount || 0), 0) || 0;
                                                    const fullyPaidViaGateway = totalAgreed > 0 && gatewaySalesTotal >= totalAgreed;
                                                    const isOverdue = !fullyPaidViaGateway && student.payments?.some(p =>
                                                        p.status === 'pending' && new Date(p.due_date) < yesterday
                                                    );

                                                    return (
                                                        <TableRow
                                                            key={student.id}
                                                            className={isOverdue ? 'bg-red-50/50 hover:bg-red-50' : ''}
                                                        >
                                                            <TableCell className="font-medium">{student.full_name}</TableCell>
                                                            <TableCell>{student.email}</TableCell>
                                                            <TableCell>
                                                                {student.coach?.full_name ? (
                                                                    <div className="flex items-center space-x-2">
                                                                        <User className="w-4 h-4 text-gray-400" />
                                                                        <span>{student.coach.full_name}</span>
                                                                    </div>
                                                                ) : (
                                                                    <span className="text-gray-400 text-sm italic">Sin asignar</span>
                                                                )}
                                                            </TableCell>
                                                            <TableCell className="w-48">
                                                                <div className="space-y-1">
                                                                    <div className="flex justify-between text-xs text-gray-600">
                                                                        <span>{progress.paid}€ / {progress.total}€</span>
                                                                        <span>{progress.percentage}%</span>
                                                                    </div>
                                                                    <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                                                                        <div
                                                                            className={`h-full rounded-full transition-all duration-500 ${progress.percentage >= 100 ? 'bg-green-500' : 'bg-blue-500'
                                                                                }`}
                                                                            style={{ width: `${progress.percentage}%` }}
                                                                        />
                                                                    </div>
                                                                </div>
                                                            </TableCell>
                                                            <TableCell>
                                                                <div className="flex flex-col gap-1">
                                                                    {getStatusBadge(student.status)}
                                                                    {isOverdue && (
                                                                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-red-100 text-red-800 border border-red-200">
                                                                            Moroso
                                                                        </span>
                                                                    )}
                                                                </div>
                                                            </TableCell>
                                                            <TableCell className="text-right">
                                                                <div className="flex justify-end gap-2">
                                                                    <StudentPaymentDetails 
                                                                        student={student} 
                                                                        onUpdate={() => updateSingleStudent(student.id)} 
                                                                    />
                                                                    <StudentForm
                                                                        student={student}
                                                                        onSuccess={() => updateSingleStudent(student.id)}
                                                                        trigger={
                                                                            <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                                                                                <Edit2 className="h-4 w-4" />
                                                                            </Button>
                                                                        }
                                                                    />
                                                        </div>
                                                    </TableCell>
                                                </TableRow>
                                            );
                                        })
                                    )}
                                </TableBody>
                            </Table>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
