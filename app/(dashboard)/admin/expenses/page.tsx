import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { TrendingUp } from 'lucide-react';

export default function AdminExpensesPage() {
    return (
        <div className="space-y-8">
            <div>
                <h1 className="text-3xl font-semibold text-gray-900">Gastos</h1>
                <p className="text-gray-600 mt-1">Registro de gastos operativos</p>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center space-x-2">
                        <TrendingUp className="w-5 h-5" />
                        <span>Control de Gastos</span>
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="text-center py-10 text-gray-500">
                        <p>Módulo de gastos en construcción...</p>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
