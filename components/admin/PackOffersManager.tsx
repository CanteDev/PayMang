'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tags, ExternalLink, Trash2, PlusCircle, CreditCard } from 'lucide-react';
import { toast } from 'sonner';

interface PackOffer {
    id: string;
    pack_id: string;
    gateway: string;
    external_id: string;
    name: string;
    price: number;
    currency: string;
    checkout_url: string;
    is_active: boolean;
}

interface PackOffersManagerProps {
    packId: string;
    packName: string;
    trigger?: React.ReactNode;
}

export default function PackOffersManager({ packId, packName, trigger }: PackOffersManagerProps) {
    const [open, setOpen] = useState(false);
    const [offers, setOffers] = useState<PackOffer[]>([]);
    const [loadingOffers, setLoadingOffers] = useState(true);

    // Form state for new offer
    const [isCreating, setIsCreating] = useState(false);
    const [newGateway, setNewGateway] = useState('hotmart');
    const [newName, setNewName] = useState('');
    const [newPrice, setNewPrice] = useState('');
    const [newCurrency, setNewCurrency] = useState('EUR');
    const [newCheckoutUrl, setNewCheckoutUrl] = useState('');
    const [newExternalId, setNewExternalId] = useState('');
    const [creatingSubmit, setCreatingSubmit] = useState(false);

    const supabase = createClient();

    useEffect(() => {
        if (open) {
            loadOffers();
        } else {
            // Reset states on close
            setIsCreating(false);
            resetForm();
        }
    }, [open, packId]);

    const loadOffers = async () => {
        setLoadingOffers(true);
        try {
            const { data, error } = await supabase
                .from('pack_offers')
                .select('*')
                .eq('pack_id', packId)
                .order('created_at', { ascending: false });

            if (error) throw error;
            setOffers(data || []);
        } catch (error) {
            console.error('Error loading offers:', error);
            toast.error('Error al cargar las ofertas');
        } finally {
            setLoadingOffers(false);
        }
    };

    const resetForm = () => {
        setNewGateway('hotmart');
        setNewName('');
        setNewPrice('');
        setNewCurrency('EUR');
        setNewCheckoutUrl('');
        setNewExternalId('');
    };

    const handleCreateOffer = async (e: React.FormEvent) => {
        e.preventDefault();
        setCreatingSubmit(true);

        const priceVal = parseFloat(newPrice);
        if (isNaN(priceVal) || priceVal < 0) {
            toast.error('El precio debe ser un número válido >= 0');
            setCreatingSubmit(false);
            return;
        }

        try {
            const { error } = await (supabase
                .from('pack_offers') as any)
                .insert({
                    pack_id: packId,
                    gateway: newGateway,
                    external_id: newExternalId || null,
                    name: newName,
                    price: parseFloat(priceVal.toFixed(2)),
                    currency: newCurrency,
                    checkout_url: newCheckoutUrl || null,
                    is_active: true
                });

            if (error) throw error;

            toast.success('Oferta creada');
            setIsCreating(false);
            resetForm();
            loadOffers();
        } catch (error: any) {
            console.error('Error creating offer:', error);
            toast.error(error.message || 'Error al crear la oferta');
        } finally {
            setCreatingSubmit(false);
        }
    };

    const handleDelete = async (id: string, name: string) => {
        if (!confirm(`¿Estás seguro de eliminar la oferta "${name}"?`)) return;

        try {
            // Check if it's used in payment_links
            const { count, error: countError } = await supabase
                .from('payment_links')
                .select('id', { count: 'exact', head: true })
                .eq('pack_offer_id', id);

            if (countError) throw countError;

            if (count && count > 0) {
                toast.error(`No se puede eliminar: esta oferta tiene ${count} link(s) de pago asociados.`);
                return;
            }

            const { error: deleteError } = await (supabase
                .from('pack_offers') as any)
                .delete()
                .eq('id', id);

            if (deleteError) throw deleteError;

            toast.success('Oferta eliminada');
            loadOffers();
        } catch (error: any) {
            console.error('Error deleting offer:', error);
            toast.error(error.message || 'Error al eliminar la oferta');
        }
    };

    const getBadgeClasses = (gateway: string) => {
        switch (gateway.toLowerCase()) {
            case 'hotmart':
                return 'bg-orange-100 text-orange-700';
            case 'stripe':
                return 'bg-violet-100 text-violet-700';
            case 'sequra':
                return 'bg-emerald-100 text-emerald-700';
            default:
                return 'bg-gray-100 text-gray-800';
        }
    };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                {trigger || (
                    <Button variant="ghost" size="sm" title="Gestionar Ofertas/Precios">
                        <Tags className="w-4 h-4 text-blue-500" />
                    </Button>
                )}
            </DialogTrigger>
            <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Tags className="w-5 h-5" />
                        Ofertas: {packName}
                    </DialogTitle>
                    <DialogDescription>
                        Gestiona las diferentes modalidades de pago o precios para este Pack.
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-2">
                    {/* Add new offer toggle */}
                    {!isCreating && (
                        <div className="flex justify-between items-center bg-gray-50 p-3 rounded-lg border">
                            <span className="text-sm text-gray-600">
                                Las ofertas permiten diferenciar precios (ej. Pago Único vs Cuotas)
                            </span>
                            <Button size="sm" onClick={() => setIsCreating(true)}>
                                <PlusCircle className="w-4 h-4 mr-1.5" />
                                Añadir Oferta
                            </Button>
                        </div>
                    )}

                    {/* Create Offer Form */}
                    {isCreating && (
                        <div className="bg-white border rounded-xl p-4 shadow-sm relative overflow-hidden">
                            <div className="absolute top-0 left-0 w-1 h-full bg-blue-500"></div>
                            <h4 className="font-semibold text-sm mb-4">Nueva Modalidad de Pago</h4>
                            <form onSubmit={handleCreateOffer} className="space-y-4">
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-1.5">
                                        <Label>Gateway / Pasarela</Label>
                                        <select
                                            value={newGateway}
                                            onChange={(e) => setNewGateway(e.target.value)}
                                            className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm"
                                        >
                                            <option value="hotmart">Hotmart</option>
                                            <option value="stripe">Stripe</option>
                                            <option value="sequra">SeQura</option>
                                            <option value="manual">Transferencia / Manual</option>
                                        </select>
                                    </div>
                                    <div className="space-y-1.5">
                                        <Label>Nombre de la Oferta *</Label>
                                        <Input
                                            required
                                            placeholder="Ej: Pago Inteligente 3 Cuotas"
                                            value={newName}
                                            onChange={(e) => setNewName(e.target.value)}
                                            disabled={creatingSubmit}
                                        />
                                    </div>
                                    <div className="space-y-1.5">
                                        <Label>Precio Total *</Label>
                                        <Input
                                            type="number"
                                            required
                                            step="0.01"
                                            placeholder="0.00"
                                            value={newPrice}
                                            onChange={(e) => setNewPrice(e.target.value)}
                                            disabled={creatingSubmit}
                                        />
                                    </div>
                                    <div className="space-y-1.5">
                                        <Label>Moneda</Label>
                                        <select
                                            value={newCurrency}
                                            onChange={(e) => setNewCurrency(e.target.value)}
                                            className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm"
                                        >
                                            <option value="EUR">EUR</option>
                                            <option value="USD">USD</option>
                                            <option value="MXN">MXN</option>
                                        </select>
                                    </div>
                                    <div className="space-y-1.5 col-span-2">
                                        <Label>Link de Checkout (Opcional - Requerido para Hotmart/Stripe)</Label>
                                        <Input
                                            type="text"
                                            placeholder="https://pay.hotmart.com/... (Dejar vacío para Sequra)"
                                            value={newCheckoutUrl}
                                            onChange={(e) => setNewCheckoutUrl(e.target.value)}
                                            disabled={creatingSubmit}
                                        />
                                    </div>
                                    <div className="space-y-1.5 col-span-2">
                                        <Label>ID Externo (Opcional - Offer Code o Price ID)</Label>
                                        <Input
                                            placeholder="Ej: off_12345"
                                            value={newExternalId}
                                            onChange={(e) => setNewExternalId(e.target.value)}
                                            disabled={creatingSubmit}
                                        />
                                    </div>
                                </div>
                                <div className="flex justify-end gap-2 pt-2 border-t">
                                    <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        onClick={() => setIsCreating(false)}
                                        disabled={creatingSubmit}
                                    >
                                        Cancelar
                                    </Button>
                                    <Button type="submit" size="sm" disabled={creatingSubmit}>
                                        {creatingSubmit ? 'Guardando...' : 'Guardar Oferta'}
                                    </Button>
                                </div>
                            </form>
                        </div>
                    )}

                    {/* Offers List */}
                    {loadingOffers ? (
                        <div className="text-center py-6 text-gray-500 text-sm">Cargando ofertas...</div>
                    ) : offers.length === 0 && !isCreating ? (
                        <div className="text-center py-6 text-gray-500 text-sm bg-gray-50 rounded-lg border border-dashed">
                            No hay ofertas configuradas para este pack.
                        </div>
                    ) : offers.length > 0 ? (
                        <div className="border rounded-md overflow-hidden">
                            <Table>
                                <TableHeader className="bg-gray-50">
                                    <TableRow>
                                        <TableHead>Pasarela</TableHead>
                                        <TableHead>Nombre</TableHead>
                                        <TableHead>Precio</TableHead>
                                        <TableHead>Link</TableHead>
                                        <TableHead className="w-[50px]"></TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {offers.map((offer) => (
                                        <TableRow key={offer.id}>
                                            <TableCell>
                                                <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium capitalize ${getBadgeClasses(offer.gateway)}`}>
                                                    {offer.gateway}
                                                </span>
                                            </TableCell>
                                            <TableCell className="font-medium text-sm">
                                                {offer.name}
                                                {offer.external_id && (
                                                    <span className="block text-[10px] text-gray-400 font-normal">
                                                        ID: {offer.external_id}
                                                    </span>
                                                )}
                                            </TableCell>
                                            <TableCell className="text-sm font-semibold">
                                                {offer.price.toFixed(2)} {offer.currency}
                                            </TableCell>
                                            <TableCell>
                                                {offer.checkout_url ? (
                                                    <a
                                                        href={offer.checkout_url}
                                                        target="_blank"
                                                        rel="noreferrer"
                                                        className="text-blue-500 hover:text-blue-700 inline-flex items-center"
                                                        title={offer.checkout_url}
                                                    >
                                                        <ExternalLink className="w-3.5 h-3.5" />
                                                    </a>
                                                ) : <span className="text-gray-400 text-xs">-</span>}
                                            </TableCell>
                                            <TableCell>
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="w-6 h-6 hover:bg-red-100"
                                                    onClick={() => handleDelete(offer.id, offer.name)}
                                                    title="Eliminar oferta"
                                                >
                                                    <Trash2 className="w-3.5 h-3.5 text-red-500" />
                                                </Button>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                    ) : null}
                </div>
            </DialogContent>
        </Dialog>
    );
}
