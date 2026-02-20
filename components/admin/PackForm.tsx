'use client';

import { useState, useEffect } from 'react';
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
import { PackagePlus, Edit2, ExternalLink } from 'lucide-react';
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
}

interface PackFormProps {
    pack?: Pack;
    trigger?: React.ReactNode;
    onSuccess?: () => void;
}

export default function PackForm({ pack, trigger, onSuccess }: PackFormProps) {
    const [open, setOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const supabase = createClient();

    // Form state
    const [name, setName] = useState('');
    const [price, setPrice] = useState('');
    const [description, setDescription] = useState('');
    const [hotmartLink, setHotmartLink] = useState('');
    const [stripeLink, setStripeLink] = useState('');
    const [sequraLink, setSequraLink] = useState('');
    const [commissionCloser, setCommissionCloser] = useState('');
    const [commissionCoach, setCommissionCoach] = useState('');
    const [commissionSetter, setCommissionSetter] = useState('');
    const [isActive, setIsActive] = useState(true);

    useEffect(() => {
        if (open) {
            if (pack) {
                setName(pack.name || '');
                setPrice(pack.price?.toString() || '');
                setDescription(pack.description || '');
                setHotmartLink(pack.gateway_ids?.hotmart_link || '');
                setStripeLink(pack.gateway_ids?.stripe_link || '');
                setSequraLink(pack.gateway_ids?.sequra_link || '');
                setCommissionCloser(pack.commission_closer?.toString() || '0');
                setCommissionCoach(pack.commission_coach?.toString() || '0');
                setCommissionSetter(pack.commission_setter?.toString() || '0');
                setIsActive(pack.is_active);
            } else {
                resetForm();
            }
        }
    }, [open, pack]);

    const resetForm = () => {
        setName('');
        setPrice('');
        setDescription('');
        setHotmartLink('');
        setStripeLink('');
        setSequraLink('');
        setCommissionCloser('');
        setCommissionCoach('');
        setCommissionSetter('');
        setIsActive(true);
        setError(null);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        const priceVal = parseFloat(price);
        if (!name.trim()) {
            setError('El nombre del pack es obligatorio');
            setLoading(false);
            return;
        }
        if (isNaN(priceVal) || priceVal < 0) {
            setError('El precio debe ser un número válido');
            setLoading(false);
            return;
        }
        if (!hotmartLink && !stripeLink && !sequraLink) {
            setError('Debes configurar al menos un link de pago (Hotmart, Stripe o SeQura)');
            setLoading(false);
            return;
        }

        const gateway_ids: Record<string, string> = {};
        if (hotmartLink.trim()) gateway_ids.hotmart_link = hotmartLink.trim();
        if (stripeLink.trim()) gateway_ids.stripe_link = stripeLink.trim();
        if (sequraLink.trim()) gateway_ids.sequra_link = sequraLink.trim();

        const packData = {
            name: name.trim(),
            price: priceVal,
            description: description.trim() || null,
            gateway_ids,
            commission_closer: parseFloat(commissionCloser) || 0,
            commission_coach: parseFloat(commissionCoach) || 0,
            commission_setter: parseFloat(commissionSetter) || 0,
            is_active: isActive,
        };

        try {
            if (pack) {
                const { error: updateError } = await (supabase
                    .from('packs') as any)
                    .update(packData)
                    .eq('id', pack.id);

                if (updateError) throw updateError;
                toast.success('Pack actualizado correctamente');
            } else {
                const { error: insertError } = await (supabase
                    .from('packs') as any)
                    .insert(packData);

                if (insertError) throw insertError;
                toast.success('Pack creado correctamente');
            }

            setOpen(false);
            if (onSuccess) onSuccess();
        } catch (err: any) {
            console.error('Error saving pack:', err);
            const msg = err.message || 'Error al guardar el pack';
            setError(msg);
            toast.error(msg);
        } finally {
            setLoading(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                {trigger || (
                    <Button>
                        <PackagePlus className="w-4 h-4 mr-2" />
                        Nuevo Pack
                    </Button>
                )}
            </DialogTrigger>
            <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>
                        {pack ? 'Editar Pack' : 'Nuevo Pack'}
                    </DialogTitle>
                    <DialogDescription>
                        {pack
                            ? 'Modifica los datos del pack de formación.'
                            : 'Completa los datos para crear un nuevo pack de formación.'}
                    </DialogDescription>
                </DialogHeader>

                <form onSubmit={handleSubmit} className="space-y-5 py-2">
                    {/* Basic Info */}
                    <div className="space-y-4">
                        <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wider">
                            Información del Pack
                        </h3>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="col-span-2 space-y-1.5">
                                <Label htmlFor="pack-name">Nombre *</Label>
                                <Input
                                    id="pack-name"
                                    type="text"
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                    required
                                    disabled={loading}
                                    placeholder="Ej: Mentoring Básico"
                                />
                            </div>

                            <div className="space-y-1.5">
                                <Label htmlFor="pack-price">Precio (€) *</Label>
                                <Input
                                    id="pack-price"
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    value={price}
                                    onChange={(e) => setPrice(e.target.value)}
                                    required
                                    disabled={loading}
                                    placeholder="0.00"
                                />
                            </div>

                            <div className="space-y-1.5">
                                <Label htmlFor="pack-active">Estado</Label>
                                <div className="flex items-center h-10 gap-2">
                                    <input
                                        type="checkbox"
                                        id="pack-active"
                                        checked={isActive}
                                        onChange={(e) => setIsActive(e.target.checked)}
                                        className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                                        disabled={loading}
                                    />
                                    <Label htmlFor="pack-active" className="font-normal cursor-pointer">
                                        Pack Activo
                                    </Label>
                                </div>
                            </div>

                            <div className="col-span-2 space-y-1.5">
                                <Label htmlFor="pack-description">Descripción (opcional)</Label>
                                <Textarea
                                    id="pack-description"
                                    value={description}
                                    onChange={(e) => setDescription(e.target.value)}
                                    disabled={loading}
                                    placeholder="Breve descripción del pack..."
                                    rows={2}
                                />
                            </div>
                        </div>
                    </div>

                    {/* Payment Links */}
                    <div className="space-y-4 pt-1 border-t">
                        <div>
                            <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wider mt-4">
                                Links de Pago
                            </h3>
                            <p className="text-xs text-gray-500 mt-1">
                                Al menos un link es obligatorio. La pasarela estará disponible si su link está configurado.
                            </p>
                        </div>

                        <div className="space-y-3">
                            {/* Hotmart */}
                            <div className="space-y-1.5">
                                <Label htmlFor="hotmart-link" className="flex items-center gap-1.5">
                                    <span className="w-2 h-2 rounded-full bg-orange-400 inline-block" />
                                    Link Hotmart
                                </Label>
                                <div className="relative">
                                    <Input
                                        id="hotmart-link"
                                        type="url"
                                        value={hotmartLink}
                                        onChange={(e) => setHotmartLink(e.target.value)}
                                        disabled={loading}
                                        placeholder="https://pay.hotmart.com/..."
                                        className="pr-10"
                                    />
                                    {hotmartLink && (
                                        <a
                                            href={hotmartLink}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                                        >
                                            <ExternalLink className="w-4 h-4" />
                                        </a>
                                    )}
                                </div>
                            </div>

                            {/* Stripe */}
                            <div className="space-y-1.5">
                                <Label htmlFor="stripe-link" className="flex items-center gap-1.5">
                                    <span className="w-2 h-2 rounded-full bg-violet-500 inline-block" />
                                    Link Stripe
                                </Label>
                                <div className="relative">
                                    <Input
                                        id="stripe-link"
                                        type="url"
                                        value={stripeLink}
                                        onChange={(e) => setStripeLink(e.target.value)}
                                        disabled={loading}
                                        placeholder="https://buy.stripe.com/..."
                                        className="pr-10"
                                    />
                                    {stripeLink && (
                                        <a
                                            href={stripeLink}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                                        >
                                            <ExternalLink className="w-4 h-4" />
                                        </a>
                                    )}
                                </div>
                            </div>

                            {/* SeQura */}
                            <div className="space-y-1.5">
                                <Label htmlFor="sequra-link" className="flex items-center gap-1.5">
                                    <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />
                                    Link SeQura
                                </Label>
                                <div className="relative">
                                    <Input
                                        id="sequra-link"
                                        type="url"
                                        value={sequraLink}
                                        onChange={(e) => setSequraLink(e.target.value)}
                                        disabled={loading}
                                        placeholder="https://..."
                                        className="pr-10"
                                    />
                                    {sequraLink && (
                                        <a
                                            href={sequraLink}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                                        >
                                            <ExternalLink className="w-4 h-4" />
                                        </a>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Commission Percentages */}
                    <div className="space-y-4 pt-1 border-t">
                        <div>
                            <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wider mt-4">
                                Comisiones del Pack (%)
                            </h3>
                            <p className="text-xs text-gray-500 mt-1">
                                Porcentaje del precio del pack. 0 = sin comisión específica (usará la global de configuración).
                            </p>
                        </div>

                        <div className="grid grid-cols-3 gap-4">
                            <div className="space-y-1.5">
                                <Label htmlFor="commission-closer">Closer (%)</Label>
                                <Input
                                    id="commission-closer"
                                    type="number"
                                    min="0"
                                    max="100"
                                    step="0.01"
                                    value={commissionCloser}
                                    onChange={(e) => setCommissionCloser(e.target.value)}
                                    disabled={loading}
                                    placeholder="0"
                                />
                            </div>
                            <div className="space-y-1.5">
                                <Label htmlFor="commission-coach">Coach (%)</Label>
                                <Input
                                    id="commission-coach"
                                    type="number"
                                    min="0"
                                    max="100"
                                    step="0.01"
                                    value={commissionCoach}
                                    onChange={(e) => setCommissionCoach(e.target.value)}
                                    disabled={loading}
                                    placeholder="0"
                                />
                            </div>
                            <div className="space-y-1.5">
                                <Label htmlFor="commission-setter">Setter (%)</Label>
                                <Input
                                    id="commission-setter"
                                    type="number"
                                    min="0"
                                    max="100"
                                    step="0.01"
                                    value={commissionSetter}
                                    onChange={(e) => setCommissionSetter(e.target.value)}
                                    disabled={loading}
                                    placeholder="0"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Error */}
                    {error && (
                        <div className="text-red-600 text-sm bg-red-50 border border-red-200 p-3 rounded-lg">
                            {error}
                        </div>
                    )}

                    {/* Actions */}
                    <div className="flex justify-end gap-3 pt-2">
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => setOpen(false)}
                            disabled={loading}
                        >
                            Cancelar
                        </Button>
                        <Button type="submit" disabled={loading}>
                            {loading
                                ? (pack ? 'Guardando...' : 'Creando...')
                                : (pack ? 'Guardar Cambios' : 'Crear Pack')}
                        </Button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    );
}
