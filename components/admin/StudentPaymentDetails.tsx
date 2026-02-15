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
        agreed_price: number;
    };
    trigger?: React.ReactNode;
}

export default function StudentPaymentDetails({ student, trigger }: StudentPaymentDetailsProps) {
    const [open, setOpen] = useState(false);
    const [loading, setLoading] = useState(true);
    const [payments, setPayments] = useState<Payment[]>([]);

    // Manual Payment Form
    const [showAddPayment, setShowAddPayment] = useState(false);
    const [newAmount, setNewAmount] = useState('');
    const [newDate, setNewDate] = useState(new Date().toISOString().split('T')[0]);
    const [newMethod, setNewMethod] = useState('transfer');
    const [newNotes, setNewNotes] = useState('');
    const [submitting, setSubmitting] = useState(false);

    const supabase = createClient();

    useEffect(() => {
        if (open) {
            loadPayments();
        }
    }, [open]);

    const loadPayments = async () => {
        setLoading(true);
        const { data } = await supabase
            .from('payments')
            .select('*')
            .eq('student_id', student.id)
            .order('due_date', { ascending: true });

        if (data) setPayments(data);
        setLoading(false);
    };

    const handleAddPayment = async (e: React.FormEvent) => {
        e.preventDefault();
        setSubmitting(true);

        try {
            const res = await registerPayment({
                studentId: student.id,
                amount: parseFloat(newAmount),
                date: newDate,
                method: newMethod,
                notes: newNotes || 'Pago Manual Registrado por Admin'
            });

            if (res.error) throw new Error(res.error);

            setShowAddPayment(false);
            setNewAmount('');
            setNewNotes('');
            loadPayments(); // Reload list
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
                amount: payment.amount,
                date: new Date().toISOString().split('T')[0],
                method: 'transfer', // Default for admin verification
                paymentId: payment.id,
                notes: payment.notes || 'Cuota planificada'
            });

            if (res.error) throw new Error(res.error);
            loadPayments();
        } catch (error) {
            console.error('Error confirming payment:', error);
        }
    };

    // Calculate totals
    const totalPaid = payments
        .filter(p => p.status === 'paid')
        .reduce((sum, p) => sum + p.amount, 0);

    const totalPending = payments
        .filter(p => p.status === 'pending')
        .reduce((sum, p) => sum + p.amount, 0);

    const totalOverdue = payments
        .filter(p => p.status === 'overdue' || (p.status === 'pending' && new Date(p.due_date) < new Date()))
        .reduce((sum, p) => sum + p.amount, 0);

    const progress = student.agreed_price > 0 ? Math.round((totalPaid / student.agreed_price) * 100) : 0;

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                {trigger || (
                    <Button variant="outline" size="sm">
                        <Wallet className="w-4 h-4 mr-2" />
                        Pagos
                    </Button>
                )}
            </DialogTrigger>
            <DialogContent className="sm:max-w-[700px] max-h-[85vh] overflow-hidden flex flex-col">
                <DialogHeader>
                    <DialogTitle>Detalle de Pagos - {student.full_name}</DialogTitle>
                    <DialogDescription>
                        {student.email} | Total Acordado: {student.agreed_price.toFixed(2)}€
                    </DialogDescription>
                </DialogHeader>

                <div className="flex-1 overflow-y-auto pr-2">
                    {/* Summary Cards */}
                    <div className="grid grid-cols-3 gap-4 mb-6">
                        <div className="bg-green-50 p-3 rounded-lg border border-green-100">
                            <p className="text-xs text-green-600 font-medium">Pagado</p>
                            <p className="text-xl font-bold text-green-700">{totalPaid.toFixed(2)}€</p>
                            <p className="text-xs text-green-600 mt-1">{progress}% completado</p>
                        </div>
                        <div className="bg-yellow-50 p-3 rounded-lg border border-yellow-100">
                            <p className="text-xs text-yellow-600 font-medium">Pendiente</p>
                            <p className="text-xl font-bold text-yellow-700">{totalPending.toFixed(2)}€</p>
                        </div>
                        <div className="bg-red-50 p-3 rounded-lg border border-red-100">
                            <p className="text-xs text-red-600 font-medium">Vencido / Atrasado</p>
                            <p className="text-xl font-bold text-red-700">{totalOverdue.toFixed(2)}€</p>
                        </div>
                    </div>

                    {/* Progress Bar */}
                    <div className="w-full h-3 bg-gray-100 rounded-full mb-6 overflow-hidden">
                        <div
                            className="h-full bg-green-500 rounded-full transition-all"
                            style={{ width: `${Math.min(100, progress)}%` }}
                        />
                    </div>

                    {/* Action Bar */}
                    <div className="flex justify-between items-center mb-4">
                        <h3 className="font-semibold text-gray-900">Historial de Pagos</h3>
                        <Button
                            size="sm"
                            onClick={() => setShowAddPayment(!showAddPayment)}
                            variant={showAddPayment ? "secondary" : "default"}
                        >
                            {showAddPayment ? <X className="w-4 h-4 mr-2" /> : <Plus className="w-4 h-4 mr-2" />}
                            {showAddPayment ? 'Cancelar' : 'Registrar Pago Manual'}
                        </Button>
                    </div>

                    {/* Add Payment Form */}
                    {showAddPayment && (
                        <div className="bg-gray-50 p-4 rounded-lg mb-6 border border-gray-200 animate-in fade-in slide-in-from-top-2">
                            <h4 className="font-medium text-sm mb-3">Nuevo Pago Manual</h4>
                            <form onSubmit={handleAddPayment} className="space-y-4">
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
                                            <option value="transfer">Transferencia Bancaria</option>
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

                    {/* Payments List */}
                    <div className="space-y-3">
                        {loading && <p className="text-center text-gray-500 py-4">Cargando pagos...</p>}
                        {!loading && payments.length === 0 && (
                            <p className="text-center text-gray-500 py-8 border border-dashed rounded-lg">
                                No hay pagos registrados ni planificados.
                            </p>
                        )}
                        {payments.map((payment) => (
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
                                            {payment.method === 'transfer' ? 'Transferencia' : payment.method}
                                        </p>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
