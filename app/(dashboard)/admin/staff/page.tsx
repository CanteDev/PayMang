'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Users, Search, UserCog } from 'lucide-react';

interface Profile {
    id: string;
    email: string;
    full_name: string;
    role: string;
    is_active: boolean;
    created_at: string;
}

export default function AdminStaffPage() {
    const [staff, setStaff] = useState<Profile[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [roleFilter, setRoleFilter] = useState('all');

    const supabase = createClient();

    useEffect(() => {
        loadStaff();
    }, []);

    const loadStaff = async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('profiles')
                .select('*')
                .in('role', ['admin', 'closer', 'coach', 'setter'])
                .order('full_name');

            if (error) throw error;
            setStaff(data || []);
        } catch (error) {
            console.error('Error loading staff:', error);
        } finally {
            setLoading(false);
        }
    };

    const filteredStaff = staff.filter(member => {
        const matchesSearch =
            member.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            member.email?.toLowerCase().includes(searchTerm.toLowerCase());

        const matchesRole = roleFilter === 'all' || member.role === roleFilter;

        return matchesSearch && matchesRole;
    });

    const getRoleBadge = (role: string) => {
        const styles = {
            admin: 'bg-purple-100 text-purple-700',
            closer: 'bg-blue-100 text-blue-700',
            coach: 'bg-green-100 text-green-700',
            setter: 'bg-orange-100 text-orange-700',
        };
        return (
            <span className={`px-2 py-1 rounded-md text-xs font-medium capitalize ${styles[role as keyof typeof styles] || 'bg-gray-100 text-gray-700'}`}>
                {role}
            </span>
        );
    };

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-semibold text-gray-900">Equipo</h1>
                <p className="text-gray-600 mt-1">Gestión de miembros del equipo</p>
            </div>

            <Card>
                <CardHeader>
                    <div className="flex items-center justify-between">
                        <CardTitle className="flex items-center space-x-2">
                            <Users className="w-5 h-5" />
                            <span>Listado de Miembros</span>
                        </CardTitle>
                        {/* Future: Add Invite Button */}
                    </div>
                </CardHeader>
                <CardContent>
                    {/* Filters */}
                    <div className="flex flex-col md:flex-row gap-4 mb-6">
                        <div className="flex-1 relative">
                            <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                            <Input
                                placeholder="Buscar por nombre o email..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="pl-9"
                            />
                        </div>
                        <select
                            value={roleFilter}
                            onChange={(e) => setRoleFilter(e.target.value)}
                            className="h-10 px-3 rounded-lg border border-gray-300 bg-white text-sm"
                        >
                            <option value="all">Todos los roles</option>
                            <option value="admin">Admin</option>
                            <option value="closer">Closer</option>
                            <option value="coach">Coach</option>
                            <option value="setter">Setter</option>
                        </select>
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
                                        <TableHead>Rol</TableHead>
                                        <TableHead>Estado</TableHead>
                                        <TableHead>Fecha Registro</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {filteredStaff.length === 0 ? (
                                        <TableRow>
                                            <TableCell colSpan={5} className="text-center py-8 text-gray-500">
                                                No se encontraron miembros
                                            </TableCell>
                                        </TableRow>
                                    ) : (
                                        filteredStaff.map((member) => (
                                            <TableRow key={member.id}>
                                                <TableCell className="font-medium">{member.full_name}</TableCell>
                                                <TableCell>{member.email}</TableCell>
                                                <TableCell>{getRoleBadge(member.role)}</TableCell>
                                                <TableCell>
                                                    <span className={`px-2 py-1 rounded-full text-xs ${member.is_active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                                        {member.is_active ? 'Activo' : 'Inactivo'}
                                                    </span>
                                                </TableCell>
                                                <TableCell className="text-gray-500 text-sm">
                                                    {new Date(member.created_at).toLocaleDateString()}
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
