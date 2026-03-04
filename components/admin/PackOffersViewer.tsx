'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tags, ExternalLink } from 'lucide-react';

interface PackOffersViewerProps {
    packId: string;
    packName: string;
    trigger?: React.ReactNode;
}

export default function PackOffersViewer({ packId, packName, trigger }: PackOffersViewerProps) {
    const [open, setOpen] = useState(false);
    const [offers, setOffers] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);

    const supabase = createClient();

    useEffect(() => {
        if (open) loadOffers();
    }, [open, packId]);

    const loadOffers = async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('pack_offers')
                .select('*')
                .eq('pack_id', packId)
                .order('created_at', { ascending: false });
            if (error) throw error;
            setOffers(data || []);
        } catch (err) {
            console.error('Error loading offers:', err);
        } finally {
            setLoading(false);
        }
    };

    const badgeClass = (gateway: string) => {
        switch (gateway.toLowerCase()) {
            case 'hotmart': return 'bg-orange-100 text-orange-700';
            case 'stripe': return 'bg-violet-100 text-violet-700';
            case 'sequra': return 'bg-emerald-100 text-emerald-700';
            default: return 'bg-gray-100 text-gray-700';
        }
    };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                {trigger || (
                    <Button variant="ghost" size="sm" title="Ver Ofertas">
                        <Tags className="w-4 h-4 text-blue-500" />
                    </Button>
                )}
            </DialogTrigger>
            <DialogContent className="sm:max-w-[640px] max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Tags className="w-5 h-5" />
                        Ofertas: {packName}
                    </DialogTitle>
                    <DialogDescription>
                        Modalidades de pago disponibles para este pack.
                    </DialogDescription>
                </DialogHeader>

                <div className="py-2">
                    {loading ? (
                        <div className="text-center py-6 text-gray-500 text-sm">Cargando ofertas...</div>
                    ) : offers.length === 0 ? (
                        <div className="text-center py-6 text-gray-400 text-sm bg-gray-50 rounded-lg border border-dashed">
                            No hay ofertas configuradas para este pack.
                        </div>
                    ) : (
                        <div className="border rounded-md overflow-hidden">
                            <Table>
                                <TableHeader className="bg-gray-50">
                                    <TableRow>
                                        <TableHead className="w-[90px]">Pasarela</TableHead>
                                        <TableHead>Nombre</TableHead>
                                        <TableHead className="w-[110px]">Precio</TableHead>
                                        <TableHead className="w-[50px]">Link</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {offers.map((offer) => (
                                        <TableRow key={offer.id}>
                                            <TableCell>
                                                <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium capitalize ${badgeClass(offer.gateway)}`}>
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
                                                ) : (
                                                    <span className="text-gray-400 text-xs">-</span>
                                                )}
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
}
