'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { DollarSign, Search, CreditCard, Filter } from 'lucide-react';

interface Sale {
    id: string;
    total_amount: number;
    amount_collected: number;
    gateway: string;
    status: string;
    created_at: string;
    student?: {
        full_name: string;
        email: string;
    };
    pack?: {
        name: string;
    };
}

export default function AdminPaymentsPage() {
    const [sales, setSales] = useState<Sale[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [gatewayFilter, setGatewayFilter] = useState('all');

    const supabase = createClient();

    useEffect(() => {
        loadSales();
    }, []);

    const loadSales = async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('sales')
                .select(`
                    *,
                    student:students(full_name, email),
                    pack:packs(name)
                `)
                .order('created_at', { ascending: false });

            if (error) throw error;
            setSales(data || []);
        } catch (error) {
            console.error('Error loading sales:', error);
        } finally {
            setLoading(false);
        }
    };

    const filteredSales = sales.filter(sale => {
        const matchesSearch =
            sale.student?.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            sale.student?.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            sale.pack?.name?.toLowerCase().includes(searchTerm.toLowerCase());

        const matchesGateway = gatewayFilter === 'all' || sale.gateway === gatewayFilter;

        return matchesSearch && matchesGateway;
    });

    const getStatusBadge = (status: string) => {
        const styles = {
            completed: 'bg-green-100 text-green-700',
            pending: 'bg-yellow-100 text-yellow-700',
            failed: 'bg-red-100 text-red-700',
            refunded: 'bg-gray-100 text-gray-700',
        };
        const labels = {
            completed: 'Completado',
            pending: 'Pendiente',
            failed: 'Fallido',
            refunded: 'Reembolsado',
        };
        return (
            <span className={`px-2 py-1 rounded-md text-xs font-medium ${styles[status as keyof typeof styles] || 'bg-gray-100 text-gray-700'}`}>
                {labels[status as keyof typeof labels] || status}
            </span>
        );
    };

    const getGatewayBadge = (gateway: string) => {
        return (
            <span className="px-2 py-1 rounded-md text-xs font-medium bg-gray-100 text-gray-700 capitalize flex items-center w-fit">
                <CreditCard className="w-3 h-3 mr-1" />
                {gateway}
            </span>
        );
    }

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-semibold text-gray-900">Pagos</h1>
                <p className="text-gray-600 mt-1">Historial de transacciones y pagos recibidos</p>
            </div>

            <Card>
                <CardHeader>
                    <div className="flex items-center justify-between">
                        <CardTitle className="flex items-center space-x-2">
                            <DollarSign className="w-5 h-5" />
                            <span>Historial de Pagos</span>
                        </CardTitle>
                    </div>
                </CardHeader>
                <CardContent>
                    {/* Search & Filters */}
                    <div className="flex flex-col md:flex-row gap-4 mb-6">
                        <div className="flex-1 relative">
                            <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                            <Input
                                placeholder="Buscar por alumno, email o pack..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="pl-9"
                            />
                        </div>
                        <div className="flex items-center space-x-2">
                            <Filter className="w-4 h-4 text-gray-500" />
                            <select
                                value={gatewayFilter}
                                onChange={(e) => setGatewayFilter(e.target.value)}
                                className="h-10 px-3 rounded-lg border border-gray-300 bg-white text-sm"
                            >
                                <option value="all">Todas las pasarelas</option>
                                <option value="stripe">Stripe</option>
                                <option value="hotmart">Hotmart</option>
                                <option value="sequra">SeQura</option>
                                <option value="manual">Manual</option>
                            </select>
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
                                        <TableHead>Fecha</TableHead>
                                        <TableHead>Alumno</TableHead>
                                        <TableHead>Pack</TableHead>
                                        <TableHead>Pasarela</TableHead>
                                        <TableHead>Estado</TableHead>
                                        <TableHead className="text-right">Monto</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {filteredSales.length === 0 ? (
                                        <TableRow>
                                            <TableCell colSpan={6} className="text-center py-8 text-gray-500">
                                                No se encontraron pagos
                                            </TableCell>
                                        </TableRow>
                                    ) : (
                                        filteredSales.map((sale) => (
                                            <TableRow key={sale.id}>
                                                <TableCell className="text-gray-500 text-sm">
                                                    {new Date(sale.created_at).toLocaleDateString()}
                                                </TableCell>
                                                <TableCell>
                                                    <div className="flex flex-col">
                                                        <span className="font-medium">{sale.student?.full_name}</span>
                                                        <span className="text-xs text-gray-500">{sale.student?.email}</span>
                                                    </div>
                                                </TableCell>
                                                <TableCell>{sale.pack?.name}</TableCell>
                                                <TableCell>{getGatewayBadge(sale.gateway)}</TableCell>
                                                <TableCell>{getStatusBadge(sale.status)}</TableCell>
                                                <TableCell className="text-right font-medium">
                                                    {sale.total_amount?.toFixed(2)}€
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
