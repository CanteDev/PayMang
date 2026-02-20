'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Package, Search, Edit2, Trash2, ExternalLink, CheckCircle, XCircle } from 'lucide-react';
import PackForm from '@/components/admin/PackForm';
import { toast } from 'sonner';

interface Pack {
    id: string;
    name: string;
    price: number;
    description: string | null;
    gateway_ids: {
        hotmart_link?: string;
        stripe_link?: string;
        sequra_link?: string;
    };
    commission_closer: number;
    commission_coach: number;
    commission_setter: number;
    is_active: boolean;
    created_at: string;
}

export default function AdminPacksPage() {
    const [packs, setPacks] = useState<Pack[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
    const [deletingId, setDeletingId] = useState<string | null>(null);

    const supabase = createClient();

    useEffect(() => {
        loadPacks();
    }, []);

    const loadPacks = async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('packs')
                .select('*')
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

    const handleToggleActive = async (pack: Pack) => {
        try {
            const { error } = await (supabase
                .from('packs') as any)
                .update({ is_active: !pack.is_active })
                .eq('id', pack.id);

            if (error) throw error;
            toast.success(pack.is_active ? 'Pack desactivado' : 'Pack activado');
            loadPacks();
        } catch (err: any) {
            toast.error(err.message || 'Error al cambiar el estado');
        }
    };

    const handleDelete = async (pack: Pack) => {
        if (!confirm(`¿Estás seguro de eliminar el pack "${pack.name}"? Esta acción no se puede deshacer.`)) return;

        setDeletingId(pack.id);
        try {
            // Check if pack has any sales
            const { count, error: countError } = await supabase
                .from('sales')
                .select('id', { count: 'exact', head: true })
                .eq('pack_id', pack.id);

            if (countError) throw countError;

            if (count && count > 0) {
                toast.error(`No se puede eliminar: este pack tiene ${count} venta(s) asociada(s). Desactívalo en su lugar.`);
                return;
            }

            // Check payment_links
            const { count: linksCount, error: linksError } = await supabase
                .from('payment_links')
                .select('id', { count: 'exact', head: true })
                .eq('pack_id', pack.id);

            if (linksError) throw linksError;

            if (linksCount && linksCount > 0) {
                toast.error(`No se puede eliminar: este pack tiene ${linksCount} link(s) de pago. Desactívalo en su lugar.`);
                return;
            }

            const { error: deleteError } = await supabase
                .from('packs')
                .delete()
                .eq('id', pack.id);

            if (deleteError) throw deleteError;

            toast.success('Pack eliminado correctamente');
            loadPacks();
        } catch (err: any) {
            console.error('Error deleting pack:', err);
            toast.error(err.message || 'Error al eliminar el pack');
        } finally {
            setDeletingId(null);
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

    const getGatewayBadges = (gateway_ids: Pack['gateway_ids']) => {
        const badges = [];
        if (gateway_ids?.hotmart_link) {
            badges.push(
                <a
                    key="hotmart"
                    href={gateway_ids.hotmart_link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-orange-100 text-orange-700 hover:bg-orange-200 transition-colors"
                    title={gateway_ids.hotmart_link}
                >
                    Hotmart <ExternalLink className="w-3 h-3" />
                </a>
            );
        }
        if (gateway_ids?.stripe_link) {
            badges.push(
                <a
                    key="stripe"
                    href={gateway_ids.stripe_link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-violet-100 text-violet-700 hover:bg-violet-200 transition-colors"
                    title={gateway_ids.stripe_link}
                >
                    Stripe <ExternalLink className="w-3 h-3" />
                </a>
            );
        }
        if (gateway_ids?.sequra_link) {
            badges.push(
                <a
                    key="sequra"
                    href={gateway_ids.sequra_link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-emerald-100 text-emerald-700 hover:bg-emerald-200 transition-colors"
                    title={gateway_ids.sequra_link}
                >
                    SeQura <ExternalLink className="w-3 h-3" />
                </a>
            );
        }
        if (badges.length === 0) {
            return (
                <span className="text-xs text-gray-400 italic">Sin links configurados</span>
            );
        }
        return badges;
    };

    const stats = {
        total: packs.length,
        active: packs.filter(p => p.is_active).length,
        withHotmart: packs.filter(p => p.gateway_ids?.hotmart_link).length,
        withStripe: packs.filter(p => p.gateway_ids?.stripe_link).length,
    };

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-semibold text-gray-900">Gestión de Packs</h1>
                <p className="text-gray-600 mt-1">Administra los packs de formación y sus links de pago</p>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
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
            </div>

            <Card>
                <CardHeader>
                    <div className="flex items-center justify-between">
                        <CardTitle className="flex items-center space-x-2">
                            <Package className="w-5 h-5" />
                            <span>Listado de Packs</span>
                        </CardTitle>
                        <PackForm onSuccess={loadPacks} />
                    </div>
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
                            <option value="all">Todos los estados</option>
                            <option value="active">Solo activos</option>
                            <option value="inactive">Solo inactivos</option>
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
                                        <TableHead>Comisiones</TableHead>
                                        <TableHead>Estado</TableHead>
                                        <TableHead className="text-right">Acciones</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {filteredPacks.length === 0 ? (
                                        <TableRow>
                                            <TableCell colSpan={6} className="text-center py-12 text-gray-500">
                                                <Package className="w-10 h-10 mx-auto mb-2 text-gray-300" />
                                                <p>No se encontraron packs</p>
                                                <p className="text-xs mt-1">Crea el primero usando el botón &quot;Nuevo Pack&quot;</p>
                                            </TableCell>
                                        </TableRow>
                                    ) : (
                                        filteredPacks.map((pack) => (
                                            <TableRow key={pack.id} className={!pack.is_active ? 'opacity-60' : ''}>
                                                <TableCell>
                                                    <div>
                                                        <p className="font-medium text-gray-900">{pack.name}</p>
                                                        {pack.description && (
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
                                                        {getGatewayBadges(pack.gateway_ids)}
                                                    </div>
                                                </TableCell>
                                                <TableCell>
                                                    <div className="text-xs text-gray-600 space-y-0.5">
                                                        <div>Closer: <span className="font-medium">{pack.commission_closer.toFixed(2)}%</span></div>
                                                        <div>Coach: <span className="font-medium">{pack.commission_coach.toFixed(2)}%</span></div>
                                                        {pack.commission_setter > 0 && (
                                                            <div>Setter: <span className="font-medium">{pack.commission_setter.toFixed(2)}%</span></div>
                                                        )}
                                                    </div>
                                                </TableCell>
                                                <TableCell>
                                                    <button
                                                        onClick={() => handleToggleActive(pack)}
                                                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition-colors cursor-pointer border ${pack.is_active
                                                            ? 'bg-green-50 text-green-700 border-green-200 hover:bg-green-100'
                                                            : 'bg-gray-50 text-gray-500 border-gray-200 hover:bg-gray-100'
                                                            }`}
                                                        title={pack.is_active ? 'Clic para desactivar' : 'Clic para activar'}
                                                    >
                                                        {pack.is_active ? (
                                                            <><CheckCircle className="w-3 h-3" /> Activo</>
                                                        ) : (
                                                            <><XCircle className="w-3 h-3" /> Inactivo</>
                                                        )}
                                                    </button>
                                                </TableCell>
                                                <TableCell className="text-right">
                                                    <div className="flex items-center justify-end gap-1">
                                                        <PackForm
                                                            pack={pack}
                                                            onSuccess={loadPacks}
                                                            trigger={
                                                                <Button variant="ghost" size="sm" title="Editar pack">
                                                                    <Edit2 className="w-4 h-4 text-gray-500" />
                                                                </Button>
                                                            }
                                                        />
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            onClick={() => handleDelete(pack)}
                                                            disabled={deletingId === pack.id}
                                                            title="Eliminar pack"
                                                        >
                                                            <Trash2 className="w-4 h-4 text-red-400 hover:text-red-600" />
                                                        </Button>
                                                    </div>
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
