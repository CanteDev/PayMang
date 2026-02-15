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
import { UserPlus, Edit2 } from 'lucide-react';

interface StudentFormProps {
    student?: {
        id: string;
        email: string;
        full_name: string;
        phone: string | null;
        assigned_coach_id: string | null;
        closer_id: string | null;
        setter_id: string | null;
        status: string;
        // Optional fields for old records compatibility
        pack_id?: string | null;
        payment_method?: 'upfront' | 'installments';
        total_installments?: number;
        installment_amount?: number;
        installment_period?: number;
        start_date?: string;
    };
    onSuccess?: (student?: any) => void;
    trigger?: React.ReactNode;
}

export default function StudentForm({ student, onSuccess, trigger }: StudentFormProps) {
    const [open, setOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const [email, setEmail] = useState(student?.email || '');
    const [fullName, setFullName] = useState(student?.full_name || '');
    const [phone, setPhone] = useState(student?.phone || '');
    const [assignedCoachId, setAssignedCoachId] = useState(student?.assigned_coach_id || '');
    const [closerId, setCloserId] = useState(student?.closer_id || '');
    const [setterId, setSetterId] = useState(student?.setter_id || '');
    const [status, setStatus] = useState(student?.status || 'active');

    // New Fields for Installments
    const [packId, setPackId] = useState(student?.pack_id || '');
    const [paymentMethod, setPaymentMethod] = useState<'upfront' | 'installments'>(student?.payment_method || 'upfront');
    const [totalInstallments, setTotalInstallments] = useState(student?.total_installments || 1);
    const [installmentAmount, setInstallmentAmount] = useState(student?.installment_amount || 0);
    const [installmentPeriod, setInstallmentPeriod] = useState(student?.installment_period || 1);
    const [startDate, setStartDate] = useState(student?.start_date || new Date().toISOString().split('T')[0]);

    const [coaches, setCoaches] = useState<any[]>([]);
    const [closers, setClosers] = useState<any[]>([]);
    const [setters, setSetters] = useState<any[]>([]);
    const [packs, setPacks] = useState<any[]>([]);

    const supabase = createClient();

    useEffect(() => {
        if (open) {
            loadCoaches();
            loadClosers();
            loadSetters();
            loadPacks();
        }
    }, [open]);

    const loadPacks = async () => {
        const { data } = await supabase
            .from('packs')
            .select('id, name, price')
            .eq('is_active', true)
            .order('price');

        if (data) setPacks(data);
    };

    const loadCoaches = async () => {
        const { data } = await supabase
            .from('profiles')
            .select('id, full_name, email')
            .eq('role', 'coach')
            .eq('is_active', true)
            .order('full_name');

        if (data) setCoaches(data);
    };

    const loadClosers = async () => {
        const { data } = await supabase
            .from('profiles')
            .select('id, full_name, email')
            .eq('role', 'closer')
            .eq('is_active', true)
            .order('full_name');

        if (data) setClosers(data);
    };

    const loadSetters = async () => {
        const { data } = await supabase
            .from('profiles')
            .select('id, full_name, email')
            .eq('role', 'setter')
            .eq('is_active', true)
            .order('full_name');

        if (data) setSetters(data);
    };

    // Auto-calculate installment amount if pack changes and is upfront
    useEffect(() => {
        if (packId && paymentMethod === 'upfront') {
            const pack = packs.find(p => p.id === packId);
            if (pack) {
                setInstallmentAmount(pack.price);
                setTotalInstallments(1);
            }
        }
    }, [packId, paymentMethod, packs]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        try {
            const studentData = {
                email: email.trim(),
                full_name: fullName.trim(),
                phone: phone.trim() || null,
                assigned_coach_id: assignedCoachId || null,
                closer_id: closerId || null,
                setter_id: setterId || null,
                status,
                // New Fields
                pack_id: packId || null,
                payment_method: paymentMethod,
                total_installments: paymentMethod === 'installments' ? Number(totalInstallments) : 1,
                installment_amount: Number(installmentAmount),
                installment_period: paymentMethod === 'installments' ? Number(installmentPeriod) : 1,
                start_date: startDate,
                agreed_price: paymentMethod === 'upfront' ? Number(installmentAmount) : (Number(installmentAmount) * Number(totalInstallments))
            };

            let resultStudent = null;

            if (student?.id) {
                // Actualizar estudiante existente
                const { data, error: updateError } = await (supabase
                    .from('students') as any)
                    .update(studentData as any)
                    .eq('id', student.id)
                    .select()
                    .single();

                if (updateError) throw updateError;
                resultStudent = data;
            } else {
                // Crear nuevo estudiante
                const { data, error: insertError } = await (supabase
                    .from('students') as any)
                    .insert(studentData as any)
                    .select()
                    .single();

                if (insertError) throw insertError;
                resultStudent = data;
            }

            setOpen(false);
            if (onSuccess) onSuccess(resultStudent);

            // Reset form
            if (!student) {
                setEmail('');
                setFullName('');
                setPhone('');
                setAssignedCoachId('');
                setCloserId('');
                setSetterId('');
                setStatus('active');
                setPackId('');
                setPaymentMethod('upfront');
                setTotalInstallments(1);
                setInstallmentAmount(0);
                setInstallmentPeriod(1);
                setStartDate(new Date().toISOString().split('T')[0]);
            }
        } catch (err: any) {
            console.error('Error guardando estudiante:', err);
            setError(err.message || 'Error al guardar el estudiante');
        } finally {
            setLoading(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                {trigger || (
                    <Button variant={student ? 'secondary' : 'default'} size={student ? 'sm' : 'default'}>
                        {student ? (
                            <>
                                <Edit2 className="w-4 h-4 mr-2" />
                                Editar
                            </>
                        ) : (
                            <>
                                <UserPlus className="w-4 h-4 mr-2" />
                                Nuevo Alumno
                            </>
                        )}
                    </Button>
                )}
            </DialogTrigger>
            <DialogContent id="student-form-content" className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>
                        {student ? 'Editar Alumno' : 'Crear Nuevo Alumno'}
                    </DialogTitle>
                    <DialogDescription>
                        {student
                            ? 'Actualiza la información del alumno'
                            : 'Completa los datos para crear un nuevo alumno'}
                    </DialogDescription>
                </DialogHeader>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor="email">Email *</Label>
                        <Input
                            id="email"
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            required
                            disabled={loading || !!student}
                            placeholder="alumno@email.com"
                        />
                        {student && (
                            <p className="text-xs text-gray-500">El email no puede modificarse</p>
                        )}
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="fullName">Nombre Completo *</Label>
                        <Input
                            id="fullName"
                            type="text"
                            value={fullName}
                            onChange={(e) => setFullName(e.target.value)}
                            required
                            disabled={loading}
                            placeholder="Juan Pérez"
                        />
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="phone">Teléfono</Label>
                        <Input
                            id="phone"
                            type="tel"
                            value={phone}
                            onChange={(e) => setPhone(e.target.value)}
                            disabled={loading}
                            placeholder="+34 600 123 456"
                        />
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="coach">Coach Asignado</Label>
                        <select
                            id="coach"
                            value={assignedCoachId}
                            onChange={(e) => setAssignedCoachId(e.target.value)}
                            className="w-full h-10 px-3 rounded-lg border border-gray-300 bg-white text-sm"
                            disabled={loading}
                        >
                            <option value="">Sin coach asignado</option>
                            {coaches.map(coach => (
                                <option key={coach.id} value={coach.id}>
                                    {coach.full_name} ({coach.email})
                                </option>
                            ))}
                        </select>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="closer">Closer Asignado</Label>
                        <select
                            id="closer"
                            value={closerId}
                            onChange={(e) => setCloserId(e.target.value)}
                            className="w-full h-10 px-3 rounded-lg border border-gray-300 bg-white text-sm"
                            disabled={loading}
                        >
                            <option value="">Sin closer asignado</option>
                            {closers.map(closer => (
                                <option key={closer.id} value={closer.id}>
                                    {closer.full_name} ({closer.email})
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* Pack & Payment Config */}
                    <div className="pt-4 border-t border-gray-100">
                        <h4 className="text-sm font-semibold mb-3">Configuración de Pago</h4>

                        <div className="space-y-4">
                            <div className="space-y-2">
                                <Label htmlFor="pack">Pack Seleccionado</Label>
                                <select
                                    id="pack"
                                    value={packId}
                                    onChange={(e) => setPackId(e.target.value)}
                                    className="w-full h-10 px-3 rounded-lg border border-gray-300 bg-white text-sm"
                                    disabled={loading}
                                >
                                    <option value="">-- Seleccionar Pack --</option>
                                    {packs.map(pack => (
                                        <option key={pack.id} value={pack.id}>
                                            {pack.name} ({pack.price}€)
                                        </option>
                                    ))}
                                </select>
                            </div>

                            {packId && (
                                <>
                                    <div className="space-y-2">
                                        <Label>Modalidad de Pago</Label>
                                        <div className="flex gap-4">
                                            <div className="flex items-center space-x-2">
                                                <input
                                                    type="radio"
                                                    id="upfront"
                                                    name="paymentMethod"
                                                    value="upfront"
                                                    checked={paymentMethod === 'upfront'}
                                                    onChange={() => setPaymentMethod('upfront')}
                                                    className="w-4 h-4 text-primary-600"
                                                />
                                                <Label htmlFor="upfront" className="font-normal">Pago Único</Label>
                                            </div>
                                            <div className="flex items-center space-x-2">
                                                <input
                                                    type="radio"
                                                    id="installments"
                                                    name="paymentMethod"
                                                    value="installments"
                                                    checked={paymentMethod === 'installments'}
                                                    onChange={() => setPaymentMethod('installments')}
                                                    className="w-4 h-4 text-primary-600"
                                                />
                                                <Label htmlFor="installments" className="font-normal">Cuotas</Label>
                                            </div>
                                        </div>
                                    </div>

                                    {paymentMethod === 'installments' && (
                                        <div className="grid grid-cols-2 gap-4 bg-gray-50 p-3 rounded-lg">
                                            <div className="space-y-2">
                                                <Label htmlFor="numInstallments">Nº Cuotas</Label>
                                                <Input
                                                    id="numInstallments"
                                                    type="number"
                                                    min="1"
                                                    value={totalInstallments}
                                                    onChange={(e) => setTotalInstallments(Number(e.target.value))}
                                                />
                                            </div>
                                            <div className="space-y-2">
                                                <Label htmlFor="period">Periodicidad (meses)</Label>
                                                <Input
                                                    id="period"
                                                    type="number"
                                                    min="1"
                                                    value={installmentPeriod}
                                                    onChange={(e) => setInstallmentPeriod(Number(e.target.value))}
                                                    placeholder="1 = Mensual"
                                                />
                                            </div>
                                            <div className="space-y-2 col-span-2">
                                                <Label htmlFor="amount">Importe por Cuota (€)</Label>
                                                <Input
                                                    id="amount"
                                                    type="number"
                                                    step="0.01"
                                                    value={installmentAmount}
                                                    onChange={(e) => setInstallmentAmount(Number(e.target.value))}
                                                />
                                            </div>
                                            <div className="space-y-2 col-span-2">
                                                <Label htmlFor="start">Fecha Inicio Pagos</Label>
                                                <Input
                                                    id="start"
                                                    type="date"
                                                    value={startDate}
                                                    onChange={(e) => setStartDate(e.target.value)}
                                                />
                                            </div>
                                        </div>
                                    )}
                                </>
                            )}
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="setter">Setter Asignado</Label>
                        <select
                            id="setter"
                            value={setterId}
                            onChange={(e) => setSetterId(e.target.value)}
                            className="w-full h-10 px-3 rounded-lg border border-gray-300 bg-white text-sm"
                            disabled={loading}
                        >
                            <option value="">Sin setter asignado</option>
                            {setters.map(setter => (
                                <option key={setter.id} value={setter.id}>
                                    {setter.full_name} ({setter.email})
                                </option>
                            ))}
                        </select>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="status">Estado</Label>
                        <select
                            id="status"
                            value={status}
                            onChange={(e) => setStatus(e.target.value)}
                            className="w-full h-10 px-3 rounded-lg border border-gray-300 bg-white text-sm"
                            disabled={loading}
                        >
                            <option value="active">Activo</option>
                            <option value="inactive">Inactivo</option>
                            <option value="finished">Finalizado</option>
                            <option value="defaulted">Impago</option>
                        </select>
                    </div>

                    {error && (
                        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
                            {error}
                        </div>
                    )}

                    <div className="flex justify-end space-x-3 pt-4">
                        <Button
                            type="button"
                            variant="secondary"
                            onClick={() => setOpen(false)}
                            disabled={loading}
                        >
                            Cancelar
                        </Button>
                        <Button type="submit" disabled={loading}>
                            {loading ? 'Guardando...' : student ? 'Actualizar' : 'Crear Alumno'}
                        </Button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    );
}
