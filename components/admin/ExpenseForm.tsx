'use client';

import { useState } from 'react';
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
import { Plus } from 'lucide-react';

interface ExpenseFormProps {
    onSuccess?: () => void;
}

export default function ExpenseForm({ onSuccess }: ExpenseFormProps) {
    const [open, setOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const [description, setDescription] = useState('');
    const [category, setCategory] = useState('');
    const [amount, setAmount] = useState('');
    const [expenseDate, setExpenseDate] = useState(
        new Date().toISOString().split('T')[0]
    );

    const supabase = createClient();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        try {
            const amountNum = parseFloat(amount);

            if (isNaN(amountNum) || amountNum <= 0) {
                setError('El monto debe ser un número positivo');
                setLoading(false);
                return;
            }

            // Redondear a 2 decimales
            const roundedAmount = Math.round(amountNum * 100) / 100;

            const { error: insertError } = await (supabase
                .from('expenses') as any)
                .insert({
                    concept: description.trim(),
                    category: category.trim(),
                    amount: roundedAmount,
                    start_date: expenseDate,
                    type: 'variable',
                    recurring: false,
                });

            if (insertError) throw insertError;

            setOpen(false);
            if (onSuccess) onSuccess();

            // Reset form
            setDescription('');
            setCategory('');
            setAmount('');
            setExpenseDate(new Date().toISOString().split('T')[0]);
        } catch (err: any) {
            console.error('Error creando gasto:', err);
            setError(err.message || 'Error al crear el gasto');
        } finally {
            setLoading(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button>
                    <Plus className="w-4 h-4 mr-2" />
                    Registrar Gasto
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                    <DialogTitle>Registrar Nuevo Gasto</DialogTitle>
                    <DialogDescription>
                        Completa los datos del gasto empresarial
                    </DialogDescription>
                </DialogHeader>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor="description">Descripción *</Label>
                        <Input
                            id="description"
                            type="text"
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            required
                            disabled={loading}
                            placeholder="Ej: Licencia de software, Marketing ads..."
                        />
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="category">Categoría *</Label>
                        <Input
                            id="category"
                            type="text"
                            value={category}
                            onChange={(e) => setCategory(e.target.value)}
                            required
                            disabled={loading}
                            placeholder="Ej: Software, Marketing, Oficina..."
                        />
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="amount">Monto (€) *</Label>
                        <Input
                            id="amount"
                            type="number"
                            step="0.01"
                            min="0.01"
                            value={amount}
                            onChange={(e) => setAmount(e.target.value)}
                            required
                            disabled={loading}
                            placeholder="100.00"
                        />
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="expenseDate">Fecha del Gasto *</Label>
                        <Input
                            id="expenseDate"
                            type="date"
                            value={expenseDate}
                            onChange={(e) => setExpenseDate(e.target.value)}
                            required
                            disabled={loading}
                        />
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
                            {loading ? 'Guardando...' : 'Registrar Gasto'}
                        </Button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    );
}
