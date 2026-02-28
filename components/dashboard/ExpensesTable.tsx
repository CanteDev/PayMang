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
import {
    LineChart,
    Line,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend,
    ResponsiveContainer
} from 'recharts';
import { toast } from 'sonner';
import { deleteExpense } from '@/app/actions/expenses';
import AddExpenseDialog from './AddExpenseDialog';
import { Expense } from '@/types/database';

export default function ExpensesTable() {
    const [expenses, setExpenses] = useState<Expense[]>([]);
    const [loading, setLoading] = useState(true);

    // Default dates (Current Month)
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();
    const pad = (n: number) => n.toString().padStart(2, '0');
    const defaultFrom = `${currentYear}-${pad(currentMonth + 1)}-01`;
    const lastDay = new Date(currentYear, currentMonth + 1, 0).getDate();
    const defaultTo = `${currentYear}-${pad(currentMonth + 1)}-${pad(lastDay)}`;

    // Filters
    const [from, setFrom] = useState<string>(defaultFrom);
    const [to, setTo] = useState<string>(defaultTo);
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

            // Date Filter (Range Optimization)
            if (from && to) {
                // Optimization: Fetch expenses where start_date <= to
                query = query.lte('start_date', to);
            }

            // Type Filter
            if (typeFilter !== 'all') {
                query = query.eq('type', typeFilter);
            }

            const { data, error } = await query;

            if (error) throw error;

            // Client-side filtering for robust date range overlap
            let filtered: Expense[] = data || [];
            if (from && to) {
                const rangeStart = new Date(from);
                const rangeEnd = new Date(to);
                rangeEnd.setHours(23, 59, 59);

                filtered = filtered.filter(e => {
                    const eStart = new Date(e.start_date);
                    const eEnd = e.end_date ? new Date(e.end_date) : new Date(2100, 0, 1);

                    // Check overlap
                    if (eStart > rangeEnd) return false;
                    if (eEnd < rangeStart) return false;
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
    }, [from, to, typeFilter]);

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

    // Calculate totals and chart data based on Exact Date Range prorating
    let totalFixed = 0;
    let totalVariable = 0;
    const chartData: any[] = [];

    if (from && to) {
        const start = new Date(from);
        const end = new Date(to);

        let currentIter = new Date(start.getFullYear(), start.getMonth(), 1);
        const endLimit = new Date(end.getFullYear(), end.getMonth(), 1);

        while (currentIter <= endLimit) {
            const currYear = currentIter.getFullYear();
            const currMonth = currentIter.getMonth();
            const monthStart = new Date(currYear, currMonth, 1);
            const monthEnd = new Date(currYear, currMonth + 1, 0);

            let monthlyFixed = 0;
            let monthlyVariable = 0;

            filteredExpenses.forEach(e => {
                const eStart = new Date(e.start_date);
                const eEnd = e.end_date ? new Date(e.end_date) : new Date(2100, 0, 1);

                // Si el gasto está activo en este mes iterado
                if (eStart <= monthEnd && eEnd >= monthStart) {
                    const amount = Number(e.amount) || 0;
                    if (e.type === 'fijo') { monthlyFixed += amount; totalFixed += amount; }
                    if (e.type === 'variable') { monthlyVariable += amount; totalVariable += amount; }
                }
            });

            chartData.push({
                name: monthStart.toLocaleDateString('es-ES', { month: 'short', year: '2-digit' }),
                Fijo: monthlyFixed,
                Variable: monthlyVariable,
                Total: monthlyFixed + monthlyVariable
            });

            currentIter.setMonth(currentIter.getMonth() + 1);
        }
    }

    const total = totalFixed + totalVariable;

    // Formatting dates for the subtitle
    const fromDateLabel = new Date(from).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' });
    const toDateLabel = new Date(to).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' });
    const rangeLabel = `${fromDateLabel} - ${toDateLabel}`;

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
                            {rangeLabel}
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
                    {/* Period Filters */}
                    <div className="flex items-center gap-2">
                        <Calendar className="w-4 h-4 text-gray-500 hidden sm:block" />
                        <Input
                            type="date"
                            value={from}
                            onChange={(e) => setFrom(e.target.value)}
                            className="h-9 w-[145px] sm:w-[155px] text-sm bg-white"
                        />
                        <span className="text-gray-400 text-sm">a</span>
                        <Input
                            type="date"
                            value={to}
                            onChange={(e) => setTo(e.target.value)}
                            className="h-9 w-[145px] sm:w-[155px] text-sm bg-white"
                        />
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

            {/* Line Chart */}
            {chartData.length > 0 && (
                <Card className="mb-6 border border-gray-100 shadow-sm">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium">Evolución de Gastos Temporales</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="h-[250px] w-full mt-4">
                            <ResponsiveContainer width="100%" height="100%">
                                <LineChart
                                    data={chartData}
                                    margin={{ top: 10, right: 30, left: 0, bottom: 0 }}
                                >
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                                    <XAxis
                                        dataKey="name"
                                        fontSize={12}
                                        tickLine={false}
                                        axisLine={false}
                                        stroke="#9CA3AF"
                                    />
                                    <YAxis
                                        fontSize={12}
                                        tickLine={false}
                                        axisLine={false}
                                        tickFormatter={(v) => `${v}€`}
                                        stroke="#9CA3AF"
                                    />
                                    <Tooltip
                                        formatter={(value: any, name: any) => [`${Number(value).toFixed(2)}€`, name]}
                                        contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                                    />
                                    <Legend wrapperStyle={{ paddingTop: '10px' }} />
                                    <Line type="monotone" dataKey="Fijo" stroke="#3b82f6" strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 5 }} />
                                    <Line type="monotone" dataKey="Variable" stroke="#f97316" strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 5 }} />
                                    <Line type="monotone" dataKey="Total" stroke="#8b5cf6" strokeWidth={3} dot={{ r: 4 }} activeDot={{ r: 6 }} />
                                </LineChart>
                            </ResponsiveContainer>
                        </div>
                    </CardContent>
                </Card>
            )}

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
                                            <span className="text-gray-400 italic">Indefinido</span>
                                        )}
                                    </TableCell>
                                    <TableCell className="font-medium">
                                        {expense.concept}
                                        {(!expense.end_date) && (
                                            <span className="ml-2 text-xs bg-blue-100 text-blue-700 px-1 py-0.5 rounded">
                                                Indefinido
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
