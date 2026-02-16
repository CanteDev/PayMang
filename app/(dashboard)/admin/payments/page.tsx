'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { DollarSign, Search, CreditCard, Filter, ChevronLeft, ChevronRight } from 'lucide-react';

interface Transaction {
    id: string;
    amount: number;
    gateway: string;
    status: string;
    created_at: string;
    type: 'sale' | 'manual';
    student_name?: string;
    student_email?: string;
    pack_name?: string;
}

export default function AdminPaymentsPage() {
    const [sales, setSales] = useState<Transaction[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [gatewayFilter, setGatewayFilter] = useState('all');
    const [error, setError] = useState<string | null>(null);

    // Pagination State
    const [page, setPage] = useState(1);
    const [totalCount, setTotalCount] = useState(0);
    const PAGE_SIZE = 20;

    const supabase = createClient();

    // Reset page on filter change
    useEffect(() => {
        setPage(1);
    }, [gatewayFilter, searchTerm]);

    // Load data
    useEffect(() => {
        loadSales();
    }, [page, gatewayFilter]);

    const loadSales = async () => {
        setLoading(true);
        try {
            let query = supabase
                .from('all_transactions')
                .select('*', { count: 'exact' })
                .order('created_at', { ascending: false });

            // Server-side filter
            if (gatewayFilter !== 'all') {
                if (gatewayFilter === 'manual') {
                    query = query.eq('type', 'manual');
                } else {
                    query = query.eq('gateway', gatewayFilter);
                }
            }

            // Pagination
            const from = (page - 1) * PAGE_SIZE;
            const to = from + PAGE_SIZE - 1;
            query = query.range(from, to);

            const { data, error, count } = await query;

            if (error) throw error;
            setSales(data as any || []);
            setTotalCount(count || 0);
        } catch (err: any) {
            console.error('Error loading sales:', err);
            setError(err.message || 'Error al cargar el historial de pagos');
        } finally {
            setLoading(false);
        }
    };

    // Implement search filtering
    const filteredSales = sales.filter(sale => {
        if (!searchTerm) return true;
        const search = searchTerm.toLowerCase();
        return (
            sale.student_name?.toLowerCase().includes(search) ||
            sale.student_email?.toLowerCase().includes(search) ||
            sale.pack_name?.toLowerCase().includes(search) ||
            sale.gateway?.toLowerCase().includes(search)
        );
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
    const isRefundable = (createdAt: string) => {
        const saleDate = new Date(createdAt);
        const now = new Date();
        const differenceInTime = now.getTime() - saleDate.getTime();
        const differenceInDays = differenceInTime / (1000 * 3600 * 24);
        return differenceInDays <= 14;
    };

    const handleRefund = async (saleId: string) => {
        if (!confirm('¿Estás seguro de que deseas reembolsar este pago? Esta acción no se puede deshacer y cancelará las comisiones asociadas.')) {
            return;
        }

        try {
            const response = await fetch('/api/admin/refund', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ saleId }),
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Error al procesar el reembolso');
            }

            alert('Reembolso procesado correctamente');
            loadSales(); // Reload the table
        } catch (error: any) {
            console.error('Error:', error);
            alert(error.message || 'Error al procesar el reembolso');
        }
    };

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

                    {/* Error Display */}
                    {error && (
                        <div className="mb-6 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm flex justify-between items-center">
                            <span>{error}</span>
                            <Button variant="ghost" size="sm" onClick={() => loadSales()} className="h-8 hover:bg-red-100">
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
                                        <TableHead>Fecha</TableHead>
                                        <TableHead>Alumno</TableHead>
                                        <TableHead>Pack</TableHead>
                                        <TableHead>Pasarela</TableHead>
                                        <TableHead>Estado</TableHead>
                                        <TableHead className="text-right">Monto</TableHead>
                                        <TableHead className="text-right">Acciones</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {filteredSales.length === 0 ? (
                                        <TableRow>
                                            <TableCell colSpan={7} className="text-center py-8 text-gray-500">
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
                                                        <span className="font-medium">{sale.student_name}</span>
                                                        <span className="text-xs text-gray-500">{sale.student_email}</span>
                                                    </div>
                                                </TableCell>
                                                <TableCell>{sale.pack_name || '-'}</TableCell>
                                                <TableCell>{getGatewayBadge(sale.gateway)}</TableCell>
                                                <TableCell>{getStatusBadge(sale.status)}</TableCell>
                                                <TableCell className="text-right font-medium">
                                                    {Number(sale.amount || 0).toFixed(2)}€
                                                </TableCell>
                                                <TableCell className="text-right">
                                                    {sale.type === 'sale' && (sale.status === 'completed' || sale.status === 'paid') && isRefundable(sale.created_at) && (
                                                        <button
                                                            onClick={() => handleRefund(sale.id)}
                                                            className="text-xs text-red-600 hover:text-red-800 font-medium underline"
                                                        >
                                                            Reembolsar
                                                        </button>
                                                    )}
                                                    {sale.type === 'manual' && (
                                                        <span className="text-xs text-gray-400 italic">Manual</span>
                                                    )}
                                                </TableCell>
                                            </TableRow>
                                        ))
                                    )}
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
        </div>
    );
}
