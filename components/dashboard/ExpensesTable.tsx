'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Plus, Edit, Trash2, TrendingUp, Filter, BarChart, Calendar, Search } from 'lucide-react';
import { toast } from 'sonner';
import { deleteExpense } from '@/app/actions/expenses';
import AddExpenseDialog from './AddExpenseDialog';
import { Expense } from '@/types/database';

export default function ExpensesTable() {
    const [expenses, setExpenses] = useState<Expense[]>([]);
    const [loading, setLoading] = useState(true);

    // Filters
    const [selectedMonth, setSelectedMonth] = useState<string>(
        `${new Date().getFullYear()}-${(new Date().getMonth() + 1).toString().padStart(2, '0')}`
    );
    const [typeFilter, setTypeFilter] = useState<'all' | 'fijo' | 'variable'>('all');
    const [searchTerm, setSearchTerm] = useState('');

    // Dialog state
    const [isAddOpen, setIsAddOpen] = useState(false);
    const [editingExpense, setEditingExpense] = useState<Expense | null>(null);

    const supabase = createClient();

    const loadExpenses = async () => {
        setLoading(true);
        try {
            let query = supabase
                .from('expenses')
                .select('*')
                .order('start_date', { ascending: false });

            // Date Filter (Month)
            if (selectedMonth !== 'all') {
                const [year, month] = selectedMonth.split('-');
                const startDateStr = new Date(parseInt(year), parseInt(month) - 1, 1).toISOString().split('T')[0];
                const endDateStr = new Date(parseInt(year), parseInt(month), 0).toISOString().split('T')[0];

                // Logic:
                // 1. Expense started before or during the month
                // 2. AND (Expense has no end date OR Expense ends after or during the month)

                // Since Supabase doesn't easily support complex OR filtering on date ranges mixed with other conditions in one go efficiently without RPC or complex logical operators in client, 
                // we might fetch a bit more and filter clientside, OR use 'or' syntax.

                // Let's rely on client side filtering for the complex date range overlap to be accurate and simple, 
                // as expenses volume is likely low. So we just fetch all (or maybe just start_date <= month_end) and then filter.

                // Optimization: Fetch expenses where start_date <= month_end
                query = query.lte('start_date', endDateStr);
            }

            // Type Filter
            if (typeFilter !== 'all') {
                query = query.eq('type', typeFilter);
            }

            const { data, error } = await query;

            if (error) throw error;

            // Client-side filtering for robust date range overlap
            let filtered: Expense[] = data || [];
            if (selectedMonth !== 'all') {
                const [year, month] = selectedMonth.split('-');
                const monthStart = new Date(parseInt(year), parseInt(month) - 1, 1);
                const monthEnd = new Date(parseInt(year), parseInt(month), 0, 23, 59, 59);

                filtered = filtered.filter(e => {
                    const start = new Date(e.start_date);
                    const end = e.end_date ? new Date(e.end_date) : null;

                    // Check overlap
                    // Start must be before or equal to Month End
                    if (start > monthEnd) return false;
                    // End (if exists) must be after or equal to Month Start
                    if (end && end < monthStart) return false;

                    return true;
                });
            }

            setExpenses(filtered);
        } catch (error) {
            console.error('Error loading expenses:', error);
            toast.error('Error al cargar gastos');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadExpenses();
    }, [selectedMonth, typeFilter]);

    const handleDelete = async (id: string) => {
        if (!confirm('¿Estás seguro de que quieres eliminar este gasto?')) return;

        try {
            const result = await deleteExpense(id);
            if (result.error) {
                toast.error(result.error);
                return;
            }
            toast.success('Gasto eliminado');
            loadExpenses();
        } catch (error) {
            toast.error('Error al eliminar');
        }
    };

    const handleEdit = (expense: Expense) => {
        setEditingExpense(expense);
        setIsAddOpen(true);
    };

    const handleAdd = () => {
        setEditingExpense(null);
        setIsAddOpen(true);
    };

    // Client-side search and filtering for totals
    const filteredExpenses = expenses.filter(expense => {
        if (!searchTerm) return true;
        const term = searchTerm.toLowerCase();
        return (
            expense.concept.toLowerCase().includes(term) ||
            expense.category.toLowerCase().includes(term) ||
            (expense.notes && expense.notes.toLowerCase().includes(term))
        );
    });

    // Calculate totals based on filtered expenses
    const totalFixed = filteredExpenses
        .filter(e => e.type === 'fijo')
        .reduce((sum, e) => sum + e.amount, 0);

    const totalVariable = filteredExpenses
        .filter(e => e.type === 'variable')
        .reduce((sum, e) => sum + e.amount, 0);

    const total = totalFixed + totalVariable;

    // Generate available months (Last 12)
    const availableMonths = Array.from({ length: 12 }, (_, i) => {
        const d = new Date();
        d.setMonth(d.getMonth() - i);
        d.setDate(1);
        const key = `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, '0')}`;
        const label = d.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' });
        return { key, label };
    });

    const formatMonthLabel = (monthKey: string) => {
        if (monthKey === 'all') return 'Todo el periodo';
        const [year, month] = monthKey.split('-');
        const date = new Date(parseInt(year), parseInt(month) - 1);
        return date.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' });
    };

    return (
        <div className="space-y-6">
            {/* Summary Cards */}
            <div className="grid gap-4 md:grid-cols-3">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Total Gastos</CardTitle>
                        <TrendingUp className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{total.toFixed(2)}€</div>
                        <p className="text-xs text-muted-foreground">
                            {formatMonthLabel(selectedMonth)}
                        </p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Gastos Fijos</CardTitle>
                        <BarChart className="h-4 w-4 text-blue-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-blue-600">{totalFixed.toFixed(2)}€</div>
                        <p className="text-xs text-muted-foreground">
                            {total > 0 ? ((totalFixed / total) * 100).toFixed(1) : 0}% del total
                        </p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Gastos Variables</CardTitle>
                        <BarChart className="h-4 w-4 text-orange-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-orange-600">{totalVariable.toFixed(2)}€</div>
                        <p className="text-xs text-muted-foreground">
                            {total > 0 ? ((totalVariable / total) * 100).toFixed(1) : 0}% del total
                        </p>
                    </CardContent>
                </Card>
            </div>

            {/* Filters & Actions */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center bg-gray-50/50 p-4 rounded-lg border border-gray-100 gap-4">
                <div className="flex flex-wrap items-center gap-4 w-full md:w-auto">
                    {/* Period Filter */}
                    <div className="flex items-center gap-2">
                        <Calendar className="w-4 h-4 text-gray-500" />
                        <select
                            value={selectedMonth}
                            onChange={(e) => setSelectedMonth(e.target.value)}
                            className="h-9 rounded-md border text-sm bg-white px-2 py-1 max-w-[160px] focus:ring-2 focus:ring-slate-200 focus:border-slate-400 outline-none"
                        >
                            <option value="all">Todo el periodo</option>
                            {availableMonths.map(month => (
                                <option key={month.key} value={month.key}>
                                    {month.label}
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* Type Filter */}
                    <div className="flex items-center gap-2">
                        <Filter className="w-4 h-4 text-gray-500" />
                        <select
                            value={typeFilter}
                            onChange={(e) => setTypeFilter(e.target.value as any)}
                            className="h-9 rounded-md border text-sm bg-white px-2 py-1 max-w-[160px] focus:ring-2 focus:ring-slate-200 focus:border-slate-400 outline-none"
                        >
                            <option value="all">Todos los tipos</option>
                            <option value="fijo">Fijo</option>
                            <option value="variable">Variable</option>
                        </select>
                    </div>

                    {/* Add Expense Button (Moved closer to filters on mobile, but keeps right alignment on desktop with justify-between usually) */}
                    {/* Actually, keeping the button separated might be better layout-wise if search takes space. */}
                </div>

                <div className="flex flex-col md:flex-row gap-4 w-full md:w-auto items-center">
                    {/* Search */}
                    <div className="relative w-full md:w-64">
                        <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                        <Input
                            placeholder="Buscar concepto..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="pl-9 h-9 bg-white"
                        />
                    </div>

                    <Button onClick={handleAdd} className="w-full md:w-auto whitespace-nowrap">
                        <Plus className="w-4 h-4 mr-2" />
                        Añadir Gasto
                    </Button>
                </div>
            </div>

            {/* Table */}
            <div className="rounded-md border bg-white">
                <Table>
                    <TableHeader>
                        <TableRow className="bg-gray-50">
                            <TableHead>Fecha Inicio</TableHead>
                            <TableHead>Fecha Fin</TableHead>
                            <TableHead>Concepto</TableHead>
                            <TableHead>Categoría</TableHead>
                            <TableHead>Tipo</TableHead>
                            <TableHead className="text-right">Importe</TableHead>
                            <TableHead className="text-right">Acciones</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {loading ? (
                            <TableRow>
                                <TableCell colSpan={7} className="text-center py-8 text-gray-500">
                                    Cargando...
                                </TableCell>
                            </TableRow>
                        ) : filteredExpenses.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={7} className="text-center py-8 text-gray-500">
                                    No se encontraron gastos con estos filtros
                                </TableCell>
                            </TableRow>
                        ) : (
                            filteredExpenses.map((expense) => (
                                <TableRow key={expense.id}>
                                    <TableCell>
                                        {new Date(expense.start_date).toLocaleDateString()}
                                    </TableCell>
                                    <TableCell>
                                        {expense.end_date ? new Date(expense.end_date).toLocaleDateString() : (
                                            expense.recurring ? <span className="text-gray-400 italic">Indefinido</span> : '-'
                                        )}
                                    </TableCell>
                                    <TableCell className="font-medium">
                                        {expense.concept}
                                        {expense.recurring && (
                                            <span className="ml-2 text-xs bg-blue-100 text-blue-700 px-1 py-0.5 rounded">
                                                Recurrente
                                            </span>
                                        )}
                                        {expense.notes && (
                                            <div className="text-xs text-gray-500 truncate max-w-[200px]" title={expense.notes}>
                                                {expense.notes}
                                            </div>
                                        )}
                                    </TableCell>
                                    <TableCell>
                                        <span className="px-2 py-1 bg-gray-100 rounded-md text-xs">
                                            {expense.category}
                                        </span>
                                    </TableCell>
                                    <TableCell>
                                        <span className={`px-2 py-1 rounded-md text-xs font-medium ${expense.type === 'fijo'
                                            ? 'bg-blue-50 text-blue-700 border border-blue-100'
                                            : 'bg-orange-50 text-orange-700 border border-orange-100'
                                            }`}>
                                            {expense.type === 'fijo' ? 'Fijo' : 'Variable'}
                                        </span>
                                    </TableCell>
                                    <TableCell className="text-right font-bold">
                                        {expense.amount.toFixed(2)}€
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <div className="flex justify-end gap-2">
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                className="h-8 w-8 p-0"
                                                onClick={() => handleEdit(expense)}
                                            >
                                                <Edit className="w-4 h-4 text-gray-500" />
                                            </Button>
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                className="h-8 w-8 p-0 hover:text-red-600"
                                                onClick={() => handleDelete(expense.id)}
                                            >
                                                <Trash2 className="w-4 h-4 text-gray-500" />
                                            </Button>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
            </div>

            <AddExpenseDialog
                open={isAddOpen}
                onOpenChange={setIsAddOpen}
                onSuccess={loadExpenses}
                expenseToEdit={editingExpense}
            />
        </div>
    );
}
