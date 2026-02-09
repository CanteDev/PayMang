import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default function CloserDashboard() {
    return (
        <div className="space-y-8">
            <div>
                <h1 className="text-3xl font-bold text-gray-900">Dashboard Closer</h1>
                <p className="text-gray-600 mt-1">Gestiona tus ventas y comisiones</p>
            </div>

            <Card className="rounded-2xl border-gray-200 shadow-md">
                <CardHeader>
                    <CardTitle>Bienvenido</CardTitle>
                    <CardDescription>Dashboard en construcción</CardDescription>
                </CardHeader>
                <CardContent>
                    <p className="text-gray-600">
                        Próximamente: KPIs de tus ventas, links generados y comisiones pendientes.
                    </p>
                </CardContent>
            </Card>
        </div>
    );
}
