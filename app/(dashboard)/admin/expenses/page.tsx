import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { TrendingUp } from 'lucide-react';
import ExpensesTable from '@/components/dashboard/ExpensesTable';

export default function AdminExpensesPage() {
    return (
        <div className="space-y-8">
            <div>
                <h1 className="text-3xl font-semibold text-gray-900">Gastos</h1>
                <p className="text-gray-600 mt-1">Registro y control de gastos operativos</p>
            </div>

            <ExpensesTable />
        </div>
    );
}
