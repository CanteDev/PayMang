'use client';

import { useState, useEffect } from 'react';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Button } from '@/components/ui/button';
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { createExpense, updateExpense } from '@/app/actions/expenses';
import { toast } from 'sonner';
import { Expense } from '@/types/database';
import { Loader2 } from 'lucide-react';

interface AddExpenseDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSuccess?: () => void;
    expenseToEdit?: Expense | null;
}

const DEFAULT_CATEGORIES = [
    'Marketing',
    'Software',
    'Oficina',
    'Personal',
    'Impuestos',
    'Comisiones',
    'Otros'
];

export default function AddExpenseDialog({
    open,
    onOpenChange,
    onSuccess,
    expenseToEdit
}: AddExpenseDialogProps) {
    const [loading, setLoading] = useState(false);

    // Form State
    const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
    const [endDate, setEndDate] = useState<string>('');
    const [concept, setConcept] = useState('');
    const [amount, setAmount] = useState('');
    const [category, setCategory] = useState('');
    const [type, setType] = useState<'fijo' | 'variable'>('variable');
    const [recurring, setRecurring] = useState(false);
    const [notes, setNotes] = useState('');

    useEffect(() => {
        if (expenseToEdit) {
            setStartDate(new Date(expenseToEdit.start_date).toISOString().split('T')[0]);
            setEndDate(expenseToEdit.end_date ? new Date(expenseToEdit.end_date).toISOString().split('T')[0] : '');
            setConcept(expenseToEdit.concept);
            setAmount(expenseToEdit.amount.toString());
            setCategory(expenseToEdit.category);
            setType(expenseToEdit.type);
            setRecurring(expenseToEdit.recurring);
            setNotes(expenseToEdit.notes || '');
        } else {
            // Reset form
            setStartDate(new Date().toISOString().split('T')[0]);
            setEndDate('');
            setConcept('');
            setAmount('');
            setCategory('');
            setType('variable');
            setRecurring(false);
            setNotes('');
        }
    }, [expenseToEdit, open]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!concept || !amount || !category) {
            toast.error('Por favor completa los campos obligatorios');
            return;
        }

        setLoading(true);

        try {
            const expenseData = {
                start_date: startDate,
                end_date: endDate || null,
                concept,
                amount: parseFloat(amount),
                category,
                type,
                recurring,
                notes: notes || null
            };

            let result;
            if (expenseToEdit) {
                result = await updateExpense(expenseToEdit.id, expenseData);
            } else {
                result = await createExpense(expenseData);
            }

            if (result.error) {
                toast.error(result.error);
                return;
            }

            toast.success(expenseToEdit ? 'Gasto actualizado' : 'Gasto creado correctamente');
            onOpenChange(false);
            if (onSuccess) onSuccess();
        } catch (error) {
            console.error(error);
            toast.error('Error al guardar el gasto');
        } finally {
            setLoading(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                    <DialogTitle>{expenseToEdit ? 'Editar Gasto' : 'Añadir Nuevo Gasto'}</DialogTitle>
                    <DialogDescription>
                        Registra los detalles del gasto operativo.
                    </DialogDescription>
                </DialogHeader>

                <form onSubmit={handleSubmit} className="grid gap-4 py-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="grid gap-2">
                            <Label htmlFor="start_date">Fecha Inicio</Label>
                            <Input
                                id="start_date"
                                type="date"
                                value={startDate}
                                onChange={(e) => setStartDate(e.target.value)}
                                required
                            />
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="end_date">Fecha Fin {recurring && '(Opcional)'}</Label>
                            <Input
                                id="end_date"
                                type="date"
                                value={endDate}
                                onChange={(e) => setEndDate(e.target.value)}
                                placeholder="Sin fecha fin"
                            />
                        </div>
                    </div>
                    <div className="grid gap-2">
                        <Label htmlFor="amount">Importe (€)</Label>
                        <Input
                            id="amount"
                            type="number"
                            step="0.01"
                            placeholder="0.00"
                            value={amount}
                            onChange={(e) => setAmount(e.target.value)}
                            required
                        />
                    </div>


                    <div className="grid gap-2">
                        <Label htmlFor="concept">Concepto</Label>
                        <Input
                            id="concept"
                            placeholder="Ej: Suscripción Zoom"
                            value={concept}
                            onChange={(e) => setConcept(e.target.value)}
                            required
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="grid gap-2">
                            <Label htmlFor="category">Categoría</Label>
                            <input
                                list="categories"
                                id="category"
                                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                                value={category}
                                onChange={(e) => setCategory(e.target.value)}
                                placeholder="Seleccionar o escribir..."
                                required
                            />
                            <datalist id="categories">
                                {DEFAULT_CATEGORIES.map(cat => (
                                    <option key={cat} value={cat} />
                                ))}
                            </datalist>
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="type">Tipo</Label>
                            <select
                                id="type"
                                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                                value={type}
                                onChange={(e) => setType(e.target.value as 'fijo' | 'variable')}
                            >
                                <option value="fijo">Fijo</option>
                                <option value="variable">Variable</option>
                            </select>
                        </div>
                    </div>

                    <div className="flex items-center space-x-2">
                        <Checkbox
                            id="recurring"
                            checked={recurring}
                            onCheckedChange={(checked) => setRecurring(checked as boolean)}
                        />
                        <Label htmlFor="recurring" className="font-normal cursor-pointer">
                            Es un gasto recurrente (mensual)
                        </Label>
                    </div>

                    <div className="grid gap-2">
                        <Label htmlFor="notes">Notas (Opcional)</Label>
                        <Textarea
                            id="notes"
                            placeholder="Detalles adicionales..."
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                            className="resize-none"
                            rows={3}
                        />
                    </div>

                    <DialogFooter className="mt-4">
                        <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                            Cancelar
                        </Button>
                        <Button type="submit" disabled={loading}>
                            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            {expenseToEdit ? 'Guardar Cambios' : 'Añadir Gasto'}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog >
    );
}
