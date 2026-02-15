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
    agreed_price: number;
    payments?: {
        amount: number;
        status: string;
    }[];
}

export default function AdminStudentsPage() {
    const [students, setStudents] = useState<Student[]>([]);
    const [coaches, setCoaches] = useState<{ id: string, full_name: string }[]>([]);
    const [loading, setLoading] = useState(true);

    // Filters
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedMonth, setSelectedMonth] = useState<string>('all');
    const [statusFilter, setStatusFilter] = useState<string>('all');
    const [coachFilter, setCoachFilter] = useState<string>('all');

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
            .in('role', ['coach', 'closer', 'setter']) // Include all potential agents who might be assigned
            .order('full_name');
        setCoaches(data || []);
    };

    const loadStudents = async () => {
        setLoading(true);
        try {
            let query = supabase
                .from('students')
                .select(`
                    *,
                    coach:profiles!assigned_coach_id(full_name),
                    payments(amount, status)
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
            if (statusFilter !== 'all') {
                query = query.eq('status', statusFilter);
            }

            // Coach Filter
            if (coachFilter !== 'all') {
                if (coachFilter === 'unassigned') {
                    query = query.is('assigned_coach_id', null);
                } else {
                    query = query.eq('assigned_coach_id', coachFilter);
                }
            }

            const { data, error } = await query;

            if (error) throw error;
            setStudents(data as any || []);
        } catch (error) {
            console.error('Error loading students:', error);
        } finally {
            setLoading(false);
        }
    };

    // Client-side search (Server filter for Date/Status/Coach, Client for Name/Email)
    const filteredStudents = students.filter(student =>
        student.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        student.email?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const getPaymentProgress = (student: Student) => {
        const totalAgreed = student.agreed_price || 0;
        if (totalAgreed === 0) return { paid: 0, total: 0, percentage: 0 };

        const paid = student.payments
            ?.filter(p => p.status === 'paid')
            .reduce((sum, p) => sum + p.amount, 0) || 0;

        const percentage = Math.min(100, Math.round((paid / totalAgreed) * 100));
        return { paid, total: totalAgreed, percentage };
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
                            <div className="flex items-center gap-2">
                                <User className="w-4 h-4 text-gray-500" />
                                <select
                                    value={coachFilter}
                                    onChange={(e) => setCoachFilter(e.target.value)}
                                    className="h-9 rounded-md border text-sm bg-white px-2 py-1 max-w-[160px] focus:ring-2 focus:ring-slate-200 focus:border-slate-400 outline-none"
                                >
                                    <option value="all">Todos los coaches</option>
                                    <option value="unassigned">Sin asignar</option>
                                    {coaches.map(coach => (
                                        <option key={coach.id} value={coach.id}>
                                            {coach.full_name}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            {/* Status Filter */}
                            <div className="flex items-center gap-2">
                                <Filter className="w-4 h-4 text-gray-500" />
                                <select
                                    value={statusFilter}
                                    onChange={(e) => setStatusFilter(e.target.value)}
                                    className="h-9 rounded-md border text-sm bg-white px-2 py-1 max-w-[160px] focus:ring-2 focus:ring-slate-200 focus:border-slate-400 outline-none"
                                >
                                    <option value="all">Todos los estados</option>
                                    <option value="active">Activo</option>
                                    <option value="inactive">Inactivo</option>
                                    <option value="paused">Pausado</option>
                                </select>
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
                                            return (
                                                <TableRow key={student.id}>
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
                                                    <TableCell>{getStatusBadge(student.status)}</TableCell>
                                                    <TableCell className="text-right">
                                                        <div className="flex justify-end gap-2">
                                                            <StudentPaymentDetails student={student} />
                                                            <StudentForm
                                                                student={student}
                                                                onSuccess={loadStudents}
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
