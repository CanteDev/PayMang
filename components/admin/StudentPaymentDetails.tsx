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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Wallet, Plus, Check, X, AlertCircle, Calendar, CreditCard } from 'lucide-react';
import { Payment } from '@/types/database';
import { registerPayment } from '@/app/actions/payments';

interface StudentPaymentDetailsProps {
    student: {
        id: string;
        full_name: string;
        email: string;
    };
    trigger?: React.ReactNode;
}

export default function StudentPaymentDetails({ student, trigger }: StudentPaymentDetailsProps) {
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

    const supabase = createClient();

    useEffect(() => {
        if (open) {
            loadData();
        }
    }, [open]);

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

        // Fetch all payments for this student
        const { data: paymentsData } = await supabase
            .from('payments')
            .select('*')
            .eq('student_id', student.id)
            .order('due_date', { ascending: true });

        if (paymentsData) {
            setPayments(paymentsData);
        }

        setLoading(false);
    };

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
        }
    };

    // Totals across ALL sales for the header summary
    const globalTotalAgreed = sales.reduce((sum, s) => sum + Number(s.total_amount), 0);
    const globalTotalPaid = payments.filter(p => p.status === 'paid').reduce((sum, p) => sum + Number(p.amount), 0);
    const globalTotalOverdue = payments.filter(p => p.status === 'overdue' || (p.status === 'pending' && new Date(p.due_date) < new Date())).reduce((sum, p) => sum + p.amount, 0);
    const globalTotalPending = Math.max(0, globalTotalAgreed - globalTotalPaid);
    const globalProgress = globalTotalAgreed > 0 ? Math.round((globalTotalPaid / globalTotalAgreed) * 100) : 0;

    return (
        <Dialog open={open} onOpenChange={setOpen}>
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
                        </div>
                    </div>

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
                            const salePaid = salePayments.filter(p => p.status === 'paid').reduce((s, p) => s + p.amount, 0);
                            const saleProgress = sale.total_amount > 0 ? Math.round((salePaid / sale.total_amount) * 100) : 0;

                            return (
                                <div key={sale.id} className="border border-gray-200 rounded-lg overflow-hidden">
                                    {/* Sale Header */}
                                    <div className="bg-gray-50 px-4 py-3 border-b flex justify-between items-center">
                                        <div>
                                            <h4 className="font-semibold text-gray-900">{sale.packs?.name || 'Pack Sin Nombre'}</h4>
                                            <p className="text-sm text-gray-500">
                                                Fecha: {new Date(sale.created_at).toLocaleDateString()} |
                                                Acordado: {sale.total_amount}€ |
                                                Pagado: {salePaid}€
                                            </p>
                                        </div>
                                        <Badge variant={salePaid >= sale.total_amount ? "default" : "secondary"}>
                                            {salePaid >= sale.total_amount ? 'Completado' : `${saleProgress}%`}
                                        </Badge>
                                    </div>

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
        </Dialog>
    );
}
