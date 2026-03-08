'use client';

import { useState, useEffect, useRef } from 'react';
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Wallet, Plus, Check, X, AlertCircle, Calendar, CreditCard, Edit2, PackagePlus, Search, ChevronDown } from 'lucide-react';
import { Payment, Pack } from '@/types/database';
import { registerPayment } from '@/app/actions/payments';
import { createSaleAction, updateSaleAction } from '@/app/actions/sales';

interface StudentPaymentDetailsProps {
    student: {
        id: string;
        full_name: string;
        email: string;
    };
    trigger?: React.ReactNode;
    onUpdate?: () => void;
}

export default function StudentPaymentDetails({ student, trigger, onUpdate }: StudentPaymentDetailsProps) {
    const [open, setOpen] = useState(false);
    const [loading, setLoading] = useState(true);
    const [sales, setSales] = useState<any[]>([]);
    const [payments, setPayments] = useState<Payment[]>([]);

    // Manual Payment Form
    const [showAddPayment, setShowAddPayment] = useState(false);
    const [newAmount, setNewAmount] = useState('');
    const [newDate, setNewDate] = useState(new Date().toISOString().split('T')[0]);
    const [newMethod, setNewMethod] = useState('transfer');
    const [newNotes, setNewNotes] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [selectedSaleId, setSelectedSaleId] = useState<string>('');

    // New Sale Form
    const [showAddSale, setShowAddSale] = useState(false);
    const [salePackId, setSalePackId] = useState('');
    const [packOpen, setPackOpen] = useState(false);
    const [packSearch, setPackSearch] = useState('');
    const [salePrice, setSalePrice] = useState(0);
    const [saleMethod, setSaleMethod] = useState<'upfront' | 'installments'>('upfront');
    const [saleInstallments, setSaleInstallments] = useState(1);
    const [salePeriod, setSalePeriod] = useState(1);
    const [saleStartDate, setSaleStartDate] = useState(new Date().toISOString().split('T')[0]);

    // Edit Sale
    const [editingSaleId, setEditingSaleId] = useState<string | null>(null);
    const [packs, setPacks] = useState<Pack[]>([]);
    const [userRole, setUserRole] = useState<string | null>(null);
    const [userId, setUserId] = useState<string | null>(null);

    // Commission Rates Override
    const [globalRates, setGlobalRates] = useState<{closer: number, coach: number, setter: number} | null>(null);
    const [saleCommCloser, setSaleCommCloser] = useState<string>('');
    const [saleCommCoach, setSaleCommCoach] = useState<string>('');
    const [saleCommSetter, setSaleCommSetter] = useState<string>('');

    // Staff for Attribution
    const [coaches, setCoaches] = useState<any[]>([]);
    const [closers, setClosers] = useState<any[]>([]);
    const [setters, setSetters] = useState<any[]>([]);
    const [selectedCoachId, setSelectedCoachId] = useState('');
    const [selectedCloserId, setSelectedCloserId] = useState('');
    const [selectedSetterId, setSelectedSetterId] = useState('');

    const supabase = createClient();

    useEffect(() => {
        if (open) {
            loadData();
        }
    }, [open]);

    const handleOpenChange = (newOpen: boolean) => {
        setOpen(newOpen);
        // Cuando se cierra el modal, notificamos al componente padre
        if (!newOpen && onUpdate) {
            onUpdate();
        }
    };

    const loadData = async () => {
        setLoading(true);

        // Fetch sales with their pack details
        const { data: salesData } = await supabase
            .from('sales')
            .select(`
                *,
                packs(name)
            `)
            .eq('student_id', student.id)
            .order('created_at', { ascending: false });

        if (salesData) {
            setSales(salesData);
        }

        // Get current user and role if not already loaded
        if (!userRole) {
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
                setUserId(user.id);
                const { data: profile } = await supabase
                    .from('profiles')
                    .select('role')
                    .eq('id', user.id)
                    .single();
                if (profile && (profile as any).role) setUserRole((profile as any).role);
            }
        }

        // Fetch all payments for this student
        const { data: paymentsData } = await supabase
            .from('payments')
            .select('*')
            .eq('student_id', student.id)
            .order('due_date', { ascending: true });

        if (paymentsData) {
            setPayments(paymentsData);
        }

        // Fetch packs with their offers (for gateway display)
        const { data: packsData } = await supabase
            .from('packs')
            .select('*, commission_closer, commission_coach, commission_setter, pack_offers(*)')
            .eq('is_active', true)
            .order('name');
        if (packsData) setPacks(packsData);

        // Fetch Global Rates
        const { data: ratesData } = await supabase
            .from('app_settings')
            .select('value')
            .eq('key', 'commission_rates')
            .single();
        if (ratesData && (ratesData as any).value) {
            setGlobalRates((ratesData as any).value);
        }

        // Fetch Staff
        const { data: staffData } = await supabase
            .from('profiles')
            .select('id, full_name, role')
            .eq('is_active', true);

        if (staffData) {
            const coachesList = staffData.filter((p: any) => p.role === 'coach');
            const closersList = staffData.filter((p: any) => p.role === 'closer');
            const settersList = staffData.filter((p: any) => p.role === 'setter');

            setCoaches(coachesList);
            setClosers(closersList);
            setSetters(settersList);

            // Default selections from student if creating new
            if (!editingSaleId) {
                const { data: std } = await supabase
                    .from('students')
                    .select('assigned_coach_id, closer_id, setter_id')
                    .eq('id', student.id)
                    .single();

                if (std) {
                    setSelectedCoachId((std as any).assigned_coach_id || '');
                    setSelectedCloserId((std as any).closer_id || '');
                    setSelectedSetterId((std as any).setter_id || '');
                }
            }
        }

        setLoading(false);
    };

    useEffect(() => {
        if (salePackId && packs.length > 0) {
            const pack = packs.find(p => p.id === salePackId);
            if (pack) {
                setSalePrice(pack.price);
                
                // pack.commission_* are stored as % integers (e.g. 8 = 8%)
                // globalRates are stored as decimals (e.g. 0.08 = 8%)
                const cCloser = (pack.commission_closer && Number(pack.commission_closer) > 0)
                    ? Number(pack.commission_closer)
                    : (globalRates?.closer || 0) * 100;
                const cCoach = (pack.commission_coach && Number(pack.commission_coach) > 0)
                    ? Number(pack.commission_coach)
                    : (globalRates?.coach || 0) * 100;
                const cSetter = (pack.commission_setter && Number(pack.commission_setter) > 0)
                    ? Number(pack.commission_setter)
                    : (globalRates?.setter || 0) * 100;
                
                if (!editingSaleId) {
                    setSaleCommCloser(cCloser ? cCloser.toFixed(2) : '0');
                    setSaleCommCoach(cCoach ? cCoach.toFixed(2) : '0');
                    setSaleCommSetter(cSetter ? cSetter.toFixed(2) : '0');
                }
            }
        }
    }, [salePackId, packs, globalRates, editingSaleId]);

    const handleAddPayment = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedSaleId) {
            alert('Debes seleccionar un Pack/Venta para registrar el pago.');
            return;
        }

        setSubmitting(true);

        try {
            const res = await registerPayment({
                studentId: student.id,
                saleId: selectedSaleId,
                amount: parseFloat(newAmount),
                date: newDate,
                method: newMethod,
                notes: newNotes || 'Pago Manual Registrado por Admin'
            });

            if (res.error) throw new Error(res.error);

            setShowAddPayment(false);
            setNewAmount('');
            setNewNotes('');
            loadData(); // Reload list
        } catch (error) {
            console.error('Error adding payment:', error);
        } finally {
            setSubmitting(false);
        }
    };

    const handlePayExisting = async (payment: Payment) => {
        if (!confirm(`¿Confirmar pago de ${payment.amount}€?`)) return;

        setSubmitting(true);
        try {
            const res = await registerPayment({
                studentId: student.id,
                saleId: payment.sale_id,
                amount: payment.amount,
                date: new Date().toISOString().split('T')[0],
                method: 'transfer', // Default for admin verification
                paymentId: payment.id,
                notes: payment.notes || 'Cuota planificada'
            });

            if (res.error) throw new Error(res.error);
            loadData();
        } catch (error) {
            console.error('Error confirming payment:', error);
        } finally {
            setSubmitting(false);
        }
    };

    const handleCreateSale = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!salePackId) return;

        setSubmitting(true);
        try {
            const res = await createSaleAction(student.id, {
                pack_id: salePackId,
                gateway: 'manual',
                transaction_id: `manual_${Date.now()}`,
                agreed_price: salePrice,
                payment_method: saleMethod,
                total_installments: saleMethod === 'installments' ? saleInstallments : 1,
                installment_period: salePeriod,
                start_date: saleStartDate,
                coach_id: selectedCoachId,
                closer_id: selectedCloserId,
                setter_id: selectedSetterId,
                commission_closer: saleCommCloser ? parseFloat(saleCommCloser) / 100 : null,
                commission_coach: saleCommCoach ? parseFloat(saleCommCoach) / 100 : null,
                commission_setter: saleCommSetter ? parseFloat(saleCommSetter) / 100 : null
            });

            if (res.success) {
                setShowAddSale(false);
                setSalePackId('');
                loadData();
            } else {
                alert(res.error || 'Error al crear la venta');
            }
        } catch (error) {
            console.error('Error creating sale:', error);
        } finally {
            setSubmitting(false);
        }
    };

    const handleUpdateSale = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!editingSaleId) return;

        setSubmitting(true);
        try {
            const res = await updateSaleAction(editingSaleId, {
                pack_id: salePackId,
                agreed_price: salePrice,
                payment_method: saleMethod,
                total_installments: saleMethod === 'installments' ? saleInstallments : 1,
                installment_period: salePeriod,
                start_date: saleStartDate,
                coach_id: selectedCoachId,
                closer_id: selectedCloserId,
                setter_id: selectedSetterId,
                commission_closer: saleCommCloser ? parseFloat(saleCommCloser) / 100 : null,
                commission_coach: saleCommCoach ? parseFloat(saleCommCoach) / 100 : null,
                commission_setter: saleCommSetter ? parseFloat(saleCommSetter) / 100 : null
            });

            if (res.success) {
                setEditingSaleId(null);
                loadData();
            } else {
                alert(res.error || 'Error al actualizar la venta');
            }
        } catch (error) {
            console.error('Error updating sale:', error);
        } finally {
            setSubmitting(false);
        }
    };

    const startEditingSale = (sale: any) => {
        setEditingSaleId(sale.id);
        setSalePackId(sale.pack_id);
        setSalePrice(sale.total_amount);
        setSaleMethod(sale.payment_method || 'upfront');
        setSaleInstallments(sale.total_installments || 1);
        setSalePeriod(sale.installment_period || 1);
        setSaleStartDate(sale.start_date);
        setSelectedCoachId(sale.coach_id || '');
        setSelectedCloserId(sale.closer_id || '');
        setSelectedSetterId(sale.setter_id || '');
        
        setSaleCommCloser(sale.commission_closer != null ? (sale.commission_closer * 100).toString() : '');
        setSaleCommCoach(sale.commission_coach != null ? (sale.commission_coach * 100).toString() : '');
        setSaleCommSetter(sale.commission_setter != null ? (sale.commission_setter * 100).toString() : '');
    };

    // Totals across ALL sales for the header summary
    const globalTotalAgreed = sales.reduce((sum, s) => sum + Number(s.total_amount), 0);

    // Total Paid = Sum of amount_collected from sales (gateways) + manual payments marked as PAID
    // To avoid double counting, we only sum payments IF they are NOT linked to a gateway 
    // BUT the current logic in syncGatewayPaymentToInstallments updates payments linked to sales.
    // The most reliable way: globalTotalPaid = sum(sales.amount_collected)
    const globalTotalPaid = sales.reduce((sum, s) => sum + Number(s.amount_collected), 0);

    const globalTotalOverdue = payments
        .filter(p => (p.status === 'overdue' || (p.status === 'pending' && new Date(p.due_date) < new Date())))
        .reduce((sum, p) => sum + Number(p.amount), 0);

    const globalTotalPending = Math.max(0, globalTotalAgreed - globalTotalPaid);
    const globalProgress = globalTotalAgreed > 0 ? Math.round((globalTotalPaid / globalTotalAgreed) * 100) : 0;

    return (
        <Dialog open={open} onOpenChange={handleOpenChange}>
            <DialogTrigger asChild>
                {trigger || (
                    <Button variant="outline" size="sm">
                        <Wallet className="w-4 h-4 mr-2" />
                        Finanzas
                    </Button>
                )}
            </DialogTrigger>
            <DialogContent className="sm:max-w-[800px] max-h-[85vh] overflow-hidden flex flex-col">
                <DialogHeader>
                    <DialogTitle>Detalle Financiero - {student.full_name}</DialogTitle>
                    <DialogDescription>
                        {student.email} | Múltiples Packs Soportados
                    </DialogDescription>
                </DialogHeader>

                <div className="flex-1 overflow-y-auto pr-2">
                    {/* Global Summary Cards */}
                    <div className="grid grid-cols-4 gap-4 mb-6">
                        <div className="bg-blue-50 p-3 rounded-lg border border-blue-100">
                            <p className="text-xs text-blue-600 font-medium">Total Acordado (Todos)</p>
                            <p className="text-xl font-bold text-blue-700">{globalTotalAgreed.toFixed(2)}€</p>
                        </div>
                        <div className="bg-green-50 p-3 rounded-lg border border-green-100">
                            <p className="text-xs text-green-600 font-medium">Total Pagado</p>
                            <p className="text-xl font-bold text-green-700">{globalTotalPaid.toFixed(2)}€</p>
                            <p className="text-xs text-green-600 mt-1">{globalProgress}% global</p>
                        </div>
                        <div className="bg-yellow-50 p-3 rounded-lg border border-yellow-100">
                            <p className="text-xs text-yellow-600 font-medium">Por Pagar</p>
                            <p className="text-xl font-bold text-yellow-700">{globalTotalPending.toFixed(2)}€</p>
                        </div>
                        <div className="bg-red-50 p-3 rounded-lg border border-red-100">
                            <p className="text-xs text-red-600 font-medium">Cuotas Atrasadas</p>
                            <p className="text-xl font-bold text-red-700">{globalTotalOverdue.toFixed(2)}€</p>
                        </div>
                    </div>

                    {/* Action Bar */}
                    <div className="flex justify-between items-center mb-4">
                        <h3 className="font-semibold text-gray-900">Packs Contratados y Pagos</h3>
                        <div className="space-x-2">
                            <Button
                                size="sm"
                                onClick={() => setShowAddPayment(!showAddPayment)}
                                variant={showAddPayment ? "secondary" : "default"}
                            >
                                {showAddPayment ? <X className="w-4 h-4 mr-2" /> : <Plus className="w-4 h-4 mr-2" />}
                                {showAddPayment ? 'Cancelar' : 'Registrar Pago Manual'}
                            </Button>
                            <Button
                                size="sm"
                                onClick={() => {
                                    setShowAddSale(!showAddSale);
                                    if (!showAddSale) {
                                        setSalePackId('');
                                        setSaleMethod('upfront');
                                        setSaleInstallments(1);
                                        setSaleStartDate(new Date().toISOString().split('T')[0]);
                                        setSaleCommCloser('');
                                        setSaleCommCoach('');
                                        setSaleCommSetter('');
                                    }
                                }}
                                variant={showAddSale ? "secondary" : "outline"}
                                className={!showAddSale ? "border-primary text-primary hover:bg-primary/5" : ""}
                            >
                                {showAddSale ? <X className="w-4 h-4 mr-2" /> : <PackagePlus className="w-4 h-4 mr-2" />}
                                {showAddSale ? 'Cancelar' : 'Añadir Pack'}
                            </Button>
                        </div>
                    </div>

                    {/* Add Sale Form */}
                    {showAddSale && (
                        <div className="bg-blue-50/50 p-4 rounded-lg mb-6 border border-blue-100 animate-in fade-in slide-in-from-top-2">
                            <h4 className="font-semibold text-sm mb-3">Añadir Nuevo Pack al Alumno</h4>
                            <form onSubmit={handleCreateSale} className="space-y-4">
                                {/* Pack picker Popover - sorted by gateway then name, with inline badges */}
                                {(() => {
                                    const gwOrder: Record<string, number> = { hotmart: 0, stripe: 1, sequra: 2, manual: 3 };
                                    const gwStyles: Record<string, string> = {
                                        hotmart: 'bg-orange-100 text-orange-700',
                                        stripe: 'bg-violet-100 text-violet-700',
                                        sequra: 'bg-emerald-100 text-emerald-700',
                                        manual: 'bg-gray-100 text-gray-600',
                                    };
                                    const gwLabel: Record<string, string> = { hotmart: 'Hotmart', stripe: 'Stripe', sequra: 'SeQura', manual: 'Manual' };
                                    const getPackGateway = (p: any): string => {
                                        const offers = (p as any).pack_offers?.filter((o: any) => o.is_active) || [];
                                        return offers.sort((a: any, b: any) => (gwOrder[a.gateway] ?? 9) - (gwOrder[b.gateway] ?? 9))[0]?.gateway || 'zzz';
                                    };
                                    const sortedPacks = [...packs].sort((a, b) => {
                                        const gA = getPackGateway(a), gB = getPackGateway(b);
                                        const oA = gwOrder[gA] ?? 9, oB = gwOrder[gB] ?? 9;
                                        if (oA !== oB) return oA - oB;
                                        return a.name.localeCompare(b.name);
                                    });
                                    const filtered = sortedPacks.filter(p => p.name.toLowerCase().includes(packSearch.toLowerCase()));
                                    const selectedPackData = packs.find(p => p.id === salePackId);
                                    const selectedOffers = (selectedPackData as any)?.pack_offers?.filter((o: any) => o.is_active) || [];
                                    const selectedGateways: string[] = Array.from(new Set<string>(selectedOffers.map((o: any) => String(o.gateway)))).sort();
                                    return (
                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="space-y-2 col-span-2">
                                                <Label>Seleccionar Pack</Label>
                                                <Popover open={packOpen} onOpenChange={setPackOpen}>
                                                    <PopoverTrigger asChild>
                                                        <button
                                                            type="button"
                                                            className="w-full flex items-center justify-between gap-2 h-10 px-3 rounded-md border border-input bg-background text-sm hover:bg-gray-50 transition-colors"
                                                        >
                                                            {salePackId ? (
                                                                <span className="flex items-center gap-2 min-w-0 flex-1">
                                                                    <span className="truncate font-medium text-gray-800">{selectedPackData?.name}</span>
                                                                    <span className="text-gray-500 shrink-0">{selectedPackData?.price}€</span>
                                                                    {selectedGateways.map(gw => (
                                                                        <span key={gw} className={`text-[10px] px-1.5 py-0.5 rounded font-semibold shrink-0 ${gwStyles[gw] || 'bg-gray-100 text-gray-600'}`}>{gwLabel[gw] || gw}</span>
                                                                    ))}
                                                                </span>
                                                            ) : (
                                                                <span className="text-gray-400">-- Seleccionar pack --</span>
                                                            )}
                                                            <span className="flex items-center gap-1 shrink-0">
                                                                {salePackId && (
                                                                    <span role="button" onClick={(e) => { e.stopPropagation(); setSalePackId(''); setPackSearch(''); }} className="p-0.5 rounded hover:bg-gray-200 text-gray-400 hover:text-gray-600">
                                                                        <X className="w-3 h-3" />
                                                                    </span>
                                                                )}
                                                                <ChevronDown className="w-4 h-4 text-gray-400" />
                                                            </span>
                                                        </button>
                                                    </PopoverTrigger>
                                                    <PopoverContent className="p-0 w-[480px] max-h-80 flex flex-col" align="start" sideOffset={4}>
                                                        <div className="p-2 border-b flex items-center gap-2">
                                                            <Search className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                                                            <input autoFocus placeholder="Buscar pack..." value={packSearch} onChange={e => setPackSearch(e.target.value)} className="flex-1 text-sm outline-none bg-transparent placeholder-gray-400" />
                                                        </div>
                                                        <div className="overflow-y-auto flex-1 divide-y divide-gray-100">
                                                            {filtered.map(pack => {
                                                                const offers = (pack as any).pack_offers?.filter((o: any) => o.is_active) || [];
                                                                const gateways: string[] = Array.from(new Set<string>(offers.map((o: any) => String(o.gateway)))).sort((a, b) => (gwOrder[a] ?? 9) - (gwOrder[b] ?? 9));
                                                                const isSelected = salePackId === pack.id;
                                                                return (
                                                                    <button key={pack.id} type="button"
                                                                        onClick={() => { setSalePackId(isSelected ? '' : pack.id); setPackOpen(false); setPackSearch(''); }}
                                                                        className={`w-full flex items-center gap-3 px-3 py-2.5 text-left transition-colors hover:bg-gray-50 ${isSelected ? 'bg-blue-50 border-l-2 border-l-blue-500' : 'border-l-2 border-l-transparent'}`}
                                                                    >
                                                                        <span className="text-sm font-medium text-gray-800 truncate flex-1 min-w-0">{pack.name}</span>
                                                                        <span className="flex items-center gap-1.5 shrink-0">
                                                                            <span className="text-xs text-gray-500 whitespace-nowrap">{pack.price}€</span>
                                                                            {gateways.map(gw => (
                                                                                <span key={gw} className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${gwStyles[gw] || 'bg-gray-100 text-gray-600'}`}>{gwLabel[gw] || gw}</span>
                                                                            ))}
                                                                        </span>
                                                                    </button>
                                                                );
                                                            })}
                                                            {filtered.length === 0 && <p className="text-center text-sm text-gray-400 py-6">Sin resultados</p>}
                                                        </div>
                                                    </PopoverContent>
                                                </Popover>
                                            </div>
                                        </div>
                                    );
                                })()}

                                {/* Importe Acordado */}
                                <div className="space-y-2">
                                    <Label>Importe Acordado (€)</Label>
                                    <Input type="number" value={salePrice} onChange={e => setSalePrice(Number(e.target.value))} required />
                                </div>
                                <div className="grid grid-cols-3 gap-4">
                                    <div className="space-y-2">
                                        <Label>Modalidad</Label>
                                        <select
                                            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                                            value={saleMethod}
                                            onChange={e => setSaleMethod(e.target.value as any)}
                                        >
                                            <option value="upfront">Pago Único</option>
                                            <option value="installments">Cuotas</option>
                                        </select>
                                    </div>
                                    {saleMethod === 'installments' && (
                                        <>
                                            <div className="space-y-2">
                                                <Label>Nº Cuotas</Label>
                                                <Input
                                                    type="number"
                                                    min="1"
                                                    value={saleInstallments}
                                                    onChange={e => setSaleInstallments(Number(e.target.value))}
                                                />
                                            </div>
                                            <div className="space-y-2">
                                                <Label>Frecuencia (Meses)</Label>
                                                <Input
                                                    type="number"
                                                    min="1"
                                                    value={salePeriod}
                                                    onChange={e => setSalePeriod(Number(e.target.value))}
                                                />
                                            </div>
                                        </>
                                    )}
                                    <div className="space-y-2">
                                        <Label>Fecha Inicio</Label>
                                        <Input
                                            type="date"
                                            value={saleStartDate}
                                            onChange={e => setSaleStartDate(e.target.value)}
                                            required
                                        />
                                    </div>
                                </div>

                                {/* Agent Attribution */}
                                <div className="pt-2 border-t border-blue-200/50">
                                    <p className="text-[10px] font-semibold text-blue-600 uppercase mb-2">Atribución de Comisiones (Equipo)</p>
                                    <div className="grid grid-cols-3 gap-4">
                                        <div className="space-y-1">
                                            <Label className="text-[11px]">Closer</Label>
                                            <select
                                                className="flex h-8 w-full rounded-md border border-input bg-background px-2 py-1 text-xs"
                                                value={selectedCloserId}
                                                onChange={e => setSelectedCloserId(e.target.value)}
                                            >
                                                <option value="">-- Sin asignar --</option>
                                                {closers.map(c => <option key={c.id} value={c.id}>{c.full_name}</option>)}
                                            </select>
                                        </div>
                                        <div className="space-y-1">
                                            <Label className="text-[11px]">Coach</Label>
                                            <select
                                                className="flex h-8 w-full rounded-md border border-input bg-background px-2 py-1 text-xs"
                                                value={selectedCoachId}
                                                onChange={e => setSelectedCoachId(e.target.value)}
                                            >
                                                <option value="">-- Sin asignar --</option>
                                                {coaches.map(c => <option key={c.id} value={c.id}>{c.full_name}</option>)}
                                            </select>
                                        </div>
                                        <div className="space-y-1">
                                            <Label className="text-[11px]">Setter</Label>
                                            <select
                                                className="flex h-8 w-full rounded-md border border-input bg-background px-2 py-1 text-xs"
                                                value={selectedSetterId}
                                                onChange={e => setSelectedSetterId(e.target.value)}
                                            >
                                                <option value="">-- Sin asignar --</option>
                                                {setters.map(s => <option key={s.id} value={s.id}>{s.full_name}</option>)}
                                            </select>
                                        </div>
                                    </div>
                                </div>
                                
                                {/* Commission Override */}
                                <div className="pt-2 border-t border-blue-200/50">
                                    <p className="text-[10px] font-semibold text-blue-600 uppercase mb-2">Comisiones para esta Venta (%)</p>
                                    <div className="grid grid-cols-3 gap-4">
                                        <div className="space-y-1">
                                            <Label className="text-[11px]">Closer (%)</Label>
                                            <Input
                                                type="number"
                                                min="0"
                                                max="100"
                                                step="0.01"
                                                value={saleCommCloser}
                                                onChange={(e) => setSaleCommCloser(e.target.value)}
                                                disabled={submitting}
                                                className="h-8 text-xs"
                                            />
                                        </div>
                                        <div className="space-y-1">
                                            <Label className="text-[11px]">Coach (%)</Label>
                                            <Input
                                                type="number"
                                                min="0"
                                                max="100"
                                                step="0.01"
                                                value={saleCommCoach}
                                                onChange={(e) => setSaleCommCoach(e.target.value)}
                                                disabled={submitting}
                                                className="h-8 text-xs"
                                            />
                                        </div>
                                        <div className="space-y-1">
                                            <Label className="text-[11px]">Setter (%)</Label>
                                            <Input
                                                type="number"
                                                min="0"
                                                max="100"
                                                step="0.01"
                                                value={saleCommSetter}
                                                onChange={(e) => setSaleCommSetter(e.target.value)}
                                                disabled={submitting}
                                                className="h-8 text-xs"
                                            />
                                        </div>
                                    </div>
                                </div>
                                <div className="flex justify-end pt-2">
                                    <Button type="submit" disabled={submitting}>
                                        {submitting ? 'Creando...' : 'Confirmar Venta'}
                                    </Button>
                                </div>
                            </form>
                        </div>
                    )}

                    {/* Add Payment Form */}
                    {showAddPayment && (
                        <div className="bg-gray-50 p-4 rounded-lg mb-6 border border-gray-200 animate-in fade-in slide-in-from-top-2">
                            <h4 className="font-medium text-sm mb-3">Nuevo Pago Manual</h4>
                            <form onSubmit={handleAddPayment} className="space-y-4">
                                <div className="space-y-2">
                                    <Label>Pack / Venta a la que aplicar el pago *</Label>
                                    <select
                                        required
                                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                                        value={selectedSaleId}
                                        onChange={e => setSelectedSaleId(e.target.value)}
                                    >
                                        <option value="">Selecciona un pack</option>
                                        {sales.map(s => (
                                            <option key={s.id} value={s.id}>
                                                {s.packs?.name || 'Venta Desconocida'} - {s.total_amount}€ ({new Date(s.created_at).toLocaleDateString()})
                                            </option>
                                        ))}
                                    </select>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label>Importe (€)</Label>
                                        <Input
                                            type="number"
                                            step="0.01"
                                            required
                                            value={newAmount}
                                            onChange={e => setNewAmount(e.target.value)}
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Fecha Pago</Label>
                                        <Input
                                            type="date"
                                            required
                                            value={newDate}
                                            onChange={e => setNewDate(e.target.value)}
                                        />
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label>Método</Label>
                                        <select
                                            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                                            value={newMethod}
                                            onChange={e => setNewMethod(e.target.value)}
                                        >
                                            <option value="transfer">Transf. Bancaria</option>
                                            <option value="stripe">Stripe</option>
                                            <option value="hotmart">Hotmart</option>
                                            <option value="sequra">Sequra</option>
                                            <option value="cash">Efectivo</option>
                                            <option value="other">Otro</option>
                                        </select>
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Notas</Label>
                                        <Input
                                            value={newNotes}
                                            onChange={e => setNewNotes(e.target.value)}
                                            placeholder="Ref. transacción, concepto..."
                                        />
                                    </div>
                                </div>
                                <div className="flex justify-end pt-2">
                                    <Button type="submit" disabled={submitting}>
                                        {submitting ? 'Guardando...' : 'Guardar Pago'}
                                    </Button>
                                </div>
                            </form>
                        </div>
                    )}

                    {/* Sales & Payments List Grouped */}
                    <div className="space-y-6">
                        {loading && <p className="text-center text-gray-500 py-4">Cargando...</p>}
                        {!loading && sales.length === 0 && (
                            <p className="text-center text-gray-500 py-8 border border-dashed rounded-lg">
                                Este alumno no tiene packs contratados.
                            </p>
                        )}
                        {!loading && sales.map(sale => {
                            const salePayments = payments.filter(p => p.sale_id === sale.id);

                            // For progress, we trust the amount_collected in the Sale record (synced by webhooks)
                            const salePaid = Number(sale.amount_collected || 0);
                            const saleProgress = sale.total_amount > 0 ? Math.round((salePaid / sale.total_amount) * 100) : 0;

                            return (
                                <div key={sale.id} className="border border-gray-200 rounded-lg overflow-hidden">
                                    {/* Sale Header */}
                                    <div className="bg-gray-50 px-4 py-3 border-b flex justify-between items-center">
                                        <div className="flex-1">
                                            <div className="flex items-center gap-2">
                                                <h4 className="font-semibold text-gray-900">{sale.packs?.name || 'Pack Sin Nombre'}</h4>
                                                <Badge variant="outline" className="text-[10px] uppercase">
                                                    {sale.gateway}
                                                </Badge>
                                            </div>
                                            <p className="text-sm text-gray-500">
                                                Fecha: {new Date(sale.created_at).toLocaleDateString()} |
                                                Acordado: {sale.total_amount}€ |
                                                Pagado: {salePaid}€
                                            </p>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <div className="bg-blue-100/50 px-2 py-1 rounded text-xs font-bold text-blue-700">
                                                {saleProgress}%
                                            </div>
                                            <Badge className={
                                                salePaid >= sale.total_amount
                                                    ? "bg-green-100 text-green-700 hover:bg-green-100"
                                                    : salePaid > 0
                                                        ? "bg-blue-100 text-blue-700 hover:bg-blue-100"
                                                        : "bg-gray-100 text-gray-700 hover:bg-gray-100"
                                            }>
                                                {salePaid >= sale.total_amount ? 'Completado' : salePaid > 0 ? 'En Pago' : 'Pendiente'}
                                            </Badge>

                                            {/* Edit/Delete only for Admins or the Closer who made the sale */}
                                            {(userRole === 'admin' || (userRole === 'closer' && sale.metadata?.closer_id === userId)) ? (
                                                <>
                                                    <Button
                                                        size="sm"
                                                        variant="ghost"
                                                        className="h-8 w-8 p-0"
                                                        onClick={() => startEditingSale(sale)}
                                                        title="Editar / Reestructurar Pack"
                                                    >
                                                        <Edit2 className="w-4 h-4 text-gray-500 hover:text-blue-600" />
                                                    </Button>
                                                    <Button
                                                        size="sm"
                                                        variant="ghost"
                                                        className="h-8 w-8 p-0"
                                                        onClick={async () => {
                                                            if (confirm('¿Estás seguro de que deseas ELIMINAR este pack y todas sus cuotas pendientes?')) {
                                                                const { deleteSaleAction } = await import('@/app/actions/sales');
                                                                const res = await deleteSaleAction(sale.id);
                                                                if (res.success) {
                                                                    loadData();
                                                                } else {
                                                                    alert('Error al eliminar el pack: ' + res.error);
                                                                }
                                                            }
                                                        }}
                                                        title="Eliminar Pack"
                                                    >
                                                        <X className="w-4 h-4 text-gray-500 hover:text-red-600" />
                                                    </Button>
                                                </>
                                            ) : (
                                                <Badge variant="outline" className="text-[10px] text-gray-400 border-gray-200">
                                                    Solo Lectura
                                                </Badge>
                                            )}
                                        </div>
                                    </div>

                                    {/* Edit Sale Form In-place */}
                                    {editingSaleId === sale.id && (
                                        <div className="p-4 bg-yellow-50/50 border-b border-yellow-100 animate-in fade-in">
                                            <div className="flex justify-between items-center mb-4">
                                                <h4 className="text-sm font-semibold text-yellow-800">Reestructurar Plan de Venta</h4>
                                                <Button size="sm" variant="ghost" onClick={() => setEditingSaleId(null)}>
                                                    <X className="w-4 h-4" />
                                                </Button>
                                            </div>
                                            <form onSubmit={handleUpdateSale} className="space-y-4">
                                                <div className="grid grid-cols-2 gap-4">
                                                    <div className="space-y-2">
                                                        <Label>Importe Acordado (€)</Label>
                                                        <Input
                                                            type="number"
                                                            value={salePrice}
                                                            onChange={e => setSalePrice(Number(e.target.value))}
                                                            required
                                                        />
                                                    </div>
                                                    <div className="space-y-2">
                                                        <Label>Modalidad</Label>
                                                        <select
                                                            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                                                            value={saleMethod}
                                                            onChange={e => setSaleMethod(e.target.value as any)}
                                                        >
                                                            <option value="upfront">Pago Único</option>
                                                            <option value="installments">Cuotas</option>
                                                        </select>
                                                    </div>
                                                </div>
                                                {saleMethod === 'installments' && (
                                                    <div className="grid grid-cols-2 gap-4">
                                                        <div className="space-y-2">
                                                            <Label>Total Cuotas Planificadas</Label>
                                                            <Input
                                                                type="number"
                                                                min="1"
                                                                value={saleInstallments}
                                                                onChange={e => setSaleInstallments(Number(e.target.value))}
                                                            />
                                                        </div>
                                                        <div className="space-y-2">
                                                            <Label>Periodo (Meses)</Label>
                                                            <Input
                                                                type="number"
                                                                min="1"
                                                                value={salePeriod}
                                                                onChange={e => setSalePeriod(Number(e.target.value))}
                                                            />
                                                        </div>
                                                    </div>
                                                )}
                                                <div className="bg-yellow-100/50 p-2 rounded text-[10px] text-yellow-800 flex items-start gap-2">
                                                    <AlertCircle className="w-3 h-3 mt-0.5 shrink-0" />
                                                    <p>Al guardar, las cuotas <strong>PENDIENTES</strong> se recalcularán basadas en la deuda restante. Los pagos recibidos NO se verán afectados.</p>
                                                </div>
                                                <div className="flex justify-end gap-2">
                                                    <Button type="submit" size="sm" disabled={submitting}>
                                                        {submitting ? 'Guardando...' : 'Aplicar Cambios'}
                                                    </Button>
                                                </div>
                                            </form>
                                        </div>
                                    )}

                                    {/* Sale Payments */}
                                    <div className="p-3 space-y-2">
                                        {salePayments.length === 0 ? (
                                            <p className="text-sm text-gray-400 p-2 text-center text-italic">Ninguna cuota generada aún.</p>
                                        ) : (
                                            salePayments.map(payment => (
                                                <div
                                                    key={payment.id}
                                                    className={`flex items-center justify-between p-3 rounded-lg border ${payment.status === 'paid' ? 'bg-white border-gray-200' : 'bg-gray-50 border-gray-100 opacity-80'
                                                        }`}
                                                >
                                                    <div className="flex items-center space-x-3">
                                                        <div className={`p-2 rounded-full ${payment.status === 'paid' ? 'bg-green-100 text-green-600' :
                                                            payment.status === 'overdue' ? 'bg-red-100 text-red-600' :
                                                                'bg-gray-100 text-gray-500'
                                                            }`}>
                                                            {payment.status === 'paid' ? <Check className="w-4 h-4" /> :
                                                                payment.status === 'overdue' ? <AlertCircle className="w-4 h-4" /> :
                                                                    <Calendar className="w-4 h-4" />}
                                                        </div>
                                                        <div>
                                                            <p className="font-medium text-gray-900">{payment.amount.toFixed(2)}€</p>
                                                            <p className="text-xs text-gray-500">
                                                                {payment.notes || 'Cuota planificada'}
                                                            </p>
                                                            <p className="text-xs text-gray-400">
                                                                Vence: {new Date(payment.due_date).toLocaleDateString()}
                                                                {payment.paid_at && ` • Pagado: ${new Date(payment.paid_at).toLocaleDateString()}`}
                                                            </p>
                                                        </div>
                                                    </div>
                                                    <div className="flex flex-col items-end gap-2">
                                                        <Badge variant={
                                                            payment.status === 'paid' ? 'default' :
                                                                payment.status === 'overdue' ? 'destructive' : 'secondary'
                                                        } className={
                                                            payment.status === 'paid' ? 'bg-green-100 text-green-700 hover:bg-green-100' :
                                                                payment.status === 'overdue' ? 'bg-red-100 text-red-700 hover:bg-red-100' :
                                                                    'bg-gray-100 text-gray-700'
                                                        }>
                                                            {payment.status === 'paid' ? 'Pagado' :
                                                                payment.status === 'overdue' ? 'Atrasado' : 'Pendiente'}
                                                        </Badge>

                                                        {payment.status !== 'paid' && (
                                                            <Button
                                                                size="sm"
                                                                variant="outline"
                                                                className="h-7 text-xs px-2"
                                                                onClick={() => handlePayExisting(payment)}
                                                            >
                                                                <CreditCard className="w-3 h-3 mr-1" />
                                                                Confirmar Pago
                                                            </Button>
                                                        )}

                                                        {payment.method && (
                                                            <p className="text-xs text-gray-400 capitalize">
                                                                {payment.method === 'transfer' ? 'Transf. Bancaria' : payment.method}
                                                            </p>
                                                        )}
                                                    </div>
                                                </div>
                                            ))
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </DialogContent>
        </Dialog >
    );
}
