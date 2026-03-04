'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Package, Search, CheckCircle, XCircle } from 'lucide-react';
import { toast } from 'sonner';
import PackOffersViewer from '@/components/admin/PackOffersViewer';

interface Pack {
    id: string;
    name: string;
    price: number;
    description: string | null;
    pack_offers?: { gateway: string; is_active: boolean }[];
    commission_closer: number;
    commission_coach: number;
    commission_setter: number;
    is_active: boolean;
}

export default function CloserPacksPage() {
    const [packs, setPacks] = useState<Pack[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('active');

    const supabase = createClient();

    useEffect(() => {
        loadPacks();
    }, []);

    const loadPacks = async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('packs')
                .select('id, name, price, description, commission_closer, commission_coach, commission_setter, is_active, pack_offers(gateway, is_active)')
                .order('name');

            if (error) throw error;
            setPacks(data || []);
        } catch (error) {
            console.error('Error loading packs:', error);
            toast.error('Error al cargar los packs');
        } finally {
            setLoading(false);
        }
    };

    const filteredPacks = packs.filter(pack => {
        const matchesSearch =
            pack.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            (pack.description?.toLowerCase().includes(searchTerm.toLowerCase()) ?? false);

        const matchesStatus =
            statusFilter === 'all' ||
            (statusFilter === 'active' && pack.is_active) ||
            (statusFilter === 'inactive' && !pack.is_active);

        return matchesSearch && matchesStatus;
    });

    const getGatewayBadges = (offers: Pack['pack_offers']) => {
        const gateways = [...new Set((offers || []).map(o => o.gateway))];

        if (gateways.length === 0) {
            return <span className="text-xs text-gray-400 italic">Sin pasarelas</span>;
        }

        const styles: Record<string, string> = {
            hotmart: 'bg-orange-100 text-orange-700',
            stripe: 'bg-violet-100 text-violet-700',
            sequra: 'bg-emerald-100 text-emerald-700',
            manual: 'bg-gray-100 text-gray-600',
        };

        return gateways.map(gw => (
            <span
                key={gw}
                className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium capitalize ${styles[gw] || 'bg-gray-100 text-gray-600'}`}
            >
                {gw}
            </span>
        ));
    };

    const stats = {
        total: packs.length,
        active: packs.filter(p => p.is_active).length,
        withHotmart: packs.filter(p => p.pack_offers?.some(o => o.gateway === 'hotmart' && o.is_active)).length,
        withStripe: packs.filter(p => p.pack_offers?.some(o => o.gateway === 'stripe' && o.is_active)).length,
        withSequra: packs.filter(p => p.pack_offers?.some(o => o.gateway === 'sequra' && o.is_active)).length,
    };

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-semibold text-gray-900">Packs</h1>
                <p className="text-gray-600 mt-1">Catálogo de packs disponibles y sus comisiones</p>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                <div className="bg-white rounded-xl border p-4">
                    <p className="text-xs text-gray-500 uppercase tracking-wide">Total Packs</p>
                    <p className="text-2xl font-bold text-gray-900 mt-1">{stats.total}</p>
                </div>
                <div className="bg-white rounded-xl border p-4">
                    <p className="text-xs text-gray-500 uppercase tracking-wide">Activos</p>
                    <p className="text-2xl font-bold text-green-600 mt-1">{stats.active}</p>
                </div>
                <div className="bg-white rounded-xl border p-4">
                    <p className="text-xs text-gray-500 uppercase tracking-wide">Con Hotmart</p>
                    <p className="text-2xl font-bold text-orange-500 mt-1">{stats.withHotmart}</p>
                </div>
                <div className="bg-white rounded-xl border p-4">
                    <p className="text-xs text-gray-500 uppercase tracking-wide">Con Stripe</p>
                    <p className="text-2xl font-bold text-violet-600 mt-1">{stats.withStripe}</p>
                </div>
                <div className="bg-white rounded-xl border p-4">
                    <p className="text-xs text-gray-500 uppercase tracking-wide">Con SeQura</p>
                    <p className="text-2xl font-bold text-emerald-600 mt-1">{stats.withSequra}</p>
                </div>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center space-x-2">
                        <Package className="w-5 h-5" />
                        <span>Listado de Packs</span>
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    {/* Filters */}
                    <div className="flex flex-col md:flex-row gap-4 mb-6">
                        <div className="flex-1 relative">
                            <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                            <Input
                                placeholder="Buscar por nombre o descripción..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="pl-9"
                            />
                        </div>
                        <select
                            value={statusFilter}
                            onChange={(e) => setStatusFilter(e.target.value as 'all' | 'active' | 'inactive')}
                            className="h-10 px-3 rounded-lg border border-gray-300 bg-white text-sm"
                        >
                            <option value="active">Solo activos</option>
                            <option value="inactive">Solo inactivos</option>
                            <option value="all">Todos los estados</option>
                        </select>
                    </div>

                    {/* Table */}
                    {loading ? (
                        <div className="text-center py-10 text-gray-500">Cargando packs...</div>
                    ) : (
                        <div className="border rounded-lg overflow-hidden">
                            <Table>
                                <TableHeader>
                                    <TableRow className="bg-gray-50">
                                        <TableHead>Pack</TableHead>
                                        <TableHead>Precio</TableHead>
                                        <TableHead>Pasarelas</TableHead>
                                        <TableHead>Mi Comisión</TableHead>
                                        <TableHead>Estado</TableHead>
                                        <TableHead className="w-[60px]">Ofertas</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {filteredPacks.length === 0 ? (
                                        <tr>
                                            <td colSpan={6} className="text-center py-12 text-gray-500">
                                                <Package className="w-10 h-10 mx-auto mb-2 text-gray-300" />
                                                <p>No se encontraron packs</p>
                                            </td>
                                        </tr>
                                    ) : (
                                        filteredPacks.map((pack) => (
                                            <TableRow key={pack.id} className={!pack.is_active ? 'opacity-60' : ''}>
                                                <TableCell>
                                                    <div>
                                                        <p className="font-medium text-gray-900">{pack.name}</p>
                                                        {pack.description && pack.description.trim().toLowerCase() !== pack.name.trim().toLowerCase() && (
                                                            <p className="text-xs text-gray-500 mt-0.5 max-w-xs truncate">
                                                                {pack.description}
                                                            </p>
                                                        )}
                                                    </div>
                                                </TableCell>
                                                <TableCell className="font-semibold text-gray-900">
                                                    {pack.price.toFixed(2)}€
                                                </TableCell>
                                                <TableCell>
                                                    <div className="flex flex-wrap gap-1.5">
                                                        {getGatewayBadges(pack.pack_offers)}
                                                    </div>
                                                </TableCell>
                                                <TableCell>
                                                    <div className="text-sm font-semibold text-blue-700">
                                                        {pack.commission_closer.toFixed(2)}%
                                                    </div>
                                                    <div className="text-xs text-gray-400">
                                                        ≈ {(pack.price * pack.commission_closer / 100).toFixed(2)}€
                                                    </div>
                                                </TableCell>
                                                <TableCell>
                                                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${pack.is_active
                                                        ? 'bg-green-50 text-green-700 border-green-200'
                                                        : 'bg-gray-50 text-gray-500 border-gray-200'
                                                        }`}>
                                                        {pack.is_active ? (
                                                            <><CheckCircle className="w-3 h-3" /> Activo</>
                                                        ) : (
                                                            <><XCircle className="w-3 h-3" /> Inactivo</>
                                                        )}
                                                    </span>
                                                </TableCell>
                                                <TableCell>
                                                    <PackOffersViewer
                                                        packId={pack.id}
                                                        packName={pack.name}
                                                    />
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
