'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Users, Search, User } from 'lucide-react';
import StudentForm from '@/components/admin/StudentForm';

interface Student {
    id: string;
    email: string;
    full_name: string;
    status: string;
    assigned_coach_id: string | null;
    coach?: {
        full_name: string;
    };
    created_at: string;
}

export default function CloserStudentsPage() {
    const [students, setStudents] = useState<Student[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');

    const supabase = createClient();

    useEffect(() => {
        loadStudents();
    }, []);

    const loadStudents = async () => {
        setLoading(true);
        try {
            // Closers can view all students for now to check status
            const { data, error } = await supabase
                .from('students')
                .select(`
                    *,
                    coach:profiles!assigned_coach_id(full_name)
                `)
                .order('full_name');

            if (error) throw error;
            setStudents(data || []);
        } catch (error) {
            console.error('Error loading students:', error);
        } finally {
            setLoading(false);
        }
    };

    const filteredStudents = students.filter(student =>
        student.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        student.email?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const getStatusBadge = (status: string) => {
        const styles = {
            active: 'bg-green-100 text-green-700',
            inactive: 'bg-gray-100 text-gray-700',
            paused: 'bg-yellow-100 text-yellow-700',
        };
        const labels = {
            active: 'Activo',
            inactive: 'Inactivo',
            paused: 'Pausado',
        };
        return (
            <span className={`px-2 py-1 rounded-md text-xs font-medium ${styles[status as keyof typeof styles] || 'bg-gray-100 text-gray-700'}`}>
                {labels[status as keyof typeof labels] || status}
            </span>
        );
    };

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-semibold text-gray-900">Alumnos</h1>
                <p className="text-gray-600 mt-1">Directorio de alumnos cerrados y activos</p>
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
                    {/* Search */}
                    <div className="flex gap-4 mb-6">
                        <div className="flex-1 relative">
                            <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                            <Input
                                placeholder="Buscar por nombre o email..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="pl-9"
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
                                        <TableHead>Estado</TableHead>
                                        <TableHead>Fecha Registro</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {filteredStudents.length === 0 ? (
                                        <TableRow>
                                            <TableCell colSpan={5} className="text-center py-8 text-gray-500">
                                                No se encontraron alumnos
                                            </TableCell>
                                        </TableRow>
                                    ) : (
                                        filteredStudents.map((student) => (
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
                                                <TableCell>{getStatusBadge(student.status)}</TableCell>
                                                <TableCell className="text-gray-500 text-sm">
                                                    {new Date(student.created_at).toLocaleDateString()}
                                                </TableCell>
                                            </TableRow>
                                        ))
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
