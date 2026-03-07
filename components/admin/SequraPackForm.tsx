'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from '@/components/ui/dialog';
import { PlusCircle } from 'lucide-react';
import { toast } from 'sonner';

interface SequraPackFormProps {
    onSuccess?: () => void;
    trigger?: React.ReactNode;
}

export default function SequraPackForm({ onSuccess, trigger }: SequraPackFormProps) {
    const [open, setOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Pack fields
    const [name, setName] = useState('');
    const [price, setPrice] = useState('');
    const [description, setDescription] = useState('');
    const [commissionCloser, setCommissionCloser] = useState('');
    const [commissionCoach, setCommissionCoach] = useState('');
    const [commissionSetter, setCommissionSetter] = useState('');

    // SeQura specific
    const [sequraRef, setSequraRef] = useState('');  // external_id = Referencia SeQura

    const supabase = createClient();

    const resetForm = () => {
        setName('');
        setPrice('');
        setDescription('');
        setCommissionCloser('');
        setCommissionCoach('');
        setCommissionSetter('');
        setSequraRef('');
        setError(null);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        const priceVal = parseFloat(price);
        if (!name.trim()) { setError('El nombre del pack es obligatorio'); setLoading(false); return; }
        if (isNaN(priceVal) || priceVal <= 0) { setError('El precio debe ser mayor que 0'); setLoading(false); return; }
        if (!sequraRef.trim()) { setError('La Referencia SeQura es obligatoria'); setLoading(false); return; }

        try {
            // 1. Check if pack with this name already exists
            const { data: existingPack } = await (supabase
                .from('packs') as any)
                .select('id, name')
                .eq('name', name.trim())
                .maybeSingle();

            let packId: string;

            if (existingPack) {
                // Pack already exists — reuse it
                packId = existingPack.id;
                toast.info(`Pack "${existingPack.name}" ya existía, añadiendo oferta SeQura...`);
            } else {
                // Create new pack
                const { data: newPack, error: packError } = await (supabase
                    .from('packs') as any)
                    .insert({
                        name: name.trim(),
                        price: parseFloat(priceVal.toFixed(2)),
                        description: description.trim() || null,
                        commission_closer: parseFloat(commissionCloser) || 0,
                        commission_coach: parseFloat(commissionCoach) || 0,
                        commission_setter: parseFloat(commissionSetter) || 0,
                        is_active: true,
                    })
                    .select('id')
                    .single();

                if (packError) throw packError;
                packId = newPack.id;
            }

            // 2. Check if a SeQura offer with this reference already exists for this pack
            const { data: existingOffer } = await (supabase
                .from('pack_offers') as any)
                .select('id')
                .eq('pack_id', packId)
                .eq('gateway', 'sequra')
                .eq('external_id', sequraRef.trim())
                .maybeSingle();

            if (existingOffer) {
                toast.warning('Ya existe una oferta SeQura con esta referencia para este pack.');
                setLoading(false);
                return;
            }

            // 3. Create the SeQura pack_offer
            const { error: offerError } = await (supabase
                .from('pack_offers') as any)
                .insert({
                    pack_id: packId,
                    gateway: 'sequra',
                    name: `${name.trim()} (SeQura)`,
                    price: parseFloat(priceVal.toFixed(2)),
                    currency: 'EUR',
                    external_id: sequraRef.trim(),
                    checkout_url: null,
                    is_active: true,
                });

            if (offerError) throw offerError;

            toast.success(`Pack SeQura "${name.trim()}" creado correctamente (Ref: ${sequraRef.trim()})`);
            setOpen(false);
            resetForm();
            if (onSuccess) onSuccess();

        } catch (err: any) {
            console.error('Error creating SeQura pack:', err);
            const msg = err.message || 'Error al crear el pack';
            setError(msg);
            toast.error(msg);
        } finally {
            setLoading(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) resetForm(); }}>
            <DialogTrigger asChild>
                {trigger || (
                    <Button className="bg-emerald-600 hover:bg-emerald-700">
                        <PlusCircle className="w-4 h-4 mr-2" />
                        Añadir Pack SeQura
                    </Button>
                )}
            </DialogTrigger>
            <DialogContent className="sm:max-w-[540px] max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-emerald-100 text-emerald-700">SeQura</span>
                        Añadir Pack SeQura
                    </DialogTitle>
                    <DialogDescription>
                        Crea un pack de formación con su oferta de pago fraccionado SeQura.
                        La Referencia SeQura es el número que aparece en el backoffice de SeQura (ej: 3024412).
                    </DialogDescription>
                </DialogHeader>

                <form onSubmit={handleSubmit} className="space-y-5 py-2">
                    {/* SeQura highlight block */}
                    <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4 space-y-3">
                        <h3 className="text-sm font-semibold text-emerald-800">Datos SeQura</h3>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1.5">
                                <Label htmlFor="sequra-ref">
                                    Referencia SeQura *
                                    <span className="text-gray-500 font-normal ml-1">(ej: 3024412)</span>
                                </Label>
                                <Input
                                    id="sequra-ref"
                                    value={sequraRef}
                                    onChange={(e) => setSequraRef(e.target.value)}
                                    placeholder="3024412"
                                    required
                                    disabled={loading}
                                />
                            </div>
                            <div className="space-y-1.5">
                                <Label htmlFor="sequra-price">Precio Total (€) *</Label>
                                <Input
                                    id="sequra-price"
                                    type="number"
                                    min="0.01"
                                    step="0.01"
                                    value={price}
                                    onChange={(e) => setPrice(e.target.value)}
                                    placeholder="1997.00"
                                    required
                                    disabled={loading}
                                />
                            </div>
                        </div>
                    </div>

                    {/* Pack Info */}
                    <div className="space-y-3">
                        <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wider">Información del Pack</h3>
                        <div className="space-y-1.5">
                            <Label htmlFor="pack-name">
                                Nombre del Pack *
                                <span className="text-gray-500 font-normal ml-1">(debe coincidir con el nombre en SeQura)</span>
                            </Label>
                            <Input
                                id="pack-name"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                placeholder="Ej: EcomBomb Program II Bronze"
                                required
                                disabled={loading}
                            />
                        </div>
                        <div className="space-y-1.5">
                            <Label htmlFor="pack-desc">Descripción (opcional)</Label>
                            <Textarea
                                id="pack-desc"
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                                placeholder="Breve descripción del pack..."
                                rows={2}
                                disabled={loading}
                            />
                        </div>
                    </div>

                    {/* Commissions */}
                    <div className="space-y-3 pt-1 border-t">
                        <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wider mt-2">Comisiones (%)</h3>
                        <p className="text-xs text-gray-500">0 = usa las comisiones globales de Configuración.</p>
                        <div className="grid grid-cols-3 gap-4">
                            <div className="space-y-1.5">
                                <Label htmlFor="comm-closer">Closer (%)</Label>
                                <Input id="comm-closer" type="number" min="0" max="100" step="0.01"
                                    value={commissionCloser} onChange={(e) => setCommissionCloser(e.target.value)}
                                    placeholder="0" disabled={loading} />
                            </div>
                            <div className="space-y-1.5">
                                <Label htmlFor="comm-coach">Coach (%)</Label>
                                <Input id="comm-coach" type="number" min="0" max="100" step="0.01"
                                    value={commissionCoach} onChange={(e) => setCommissionCoach(e.target.value)}
                                    placeholder="0" disabled={loading} />
                            </div>
                            <div className="space-y-1.5">
                                <Label htmlFor="comm-setter">Setter (%)</Label>
                                <Input id="comm-setter" type="number" min="0" max="100" step="0.01"
                                    value={commissionSetter} onChange={(e) => setCommissionSetter(e.target.value)}
                                    placeholder="0" disabled={loading} />
                            </div>
                        </div>
                    </div>

                    {error && (
                        <div className="text-red-600 text-sm bg-red-50 border border-red-200 p-3 rounded-lg">
                            {error}
                        </div>
                    )}

                    <div className="flex justify-end gap-3 pt-2">
                        <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={loading}>
                            Cancelar
                        </Button>
                        <Button type="submit" disabled={loading} className="bg-emerald-600 hover:bg-emerald-700">
                            {loading ? 'Creando...' : 'Crear Pack SeQura'}
                        </Button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    );
}
