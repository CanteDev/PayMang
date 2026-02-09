import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default function SetterDashboard() {
    return (
        <div className="space-y-8">
            <div>
                <h1 className="text-3xl font-bold text-gray-900">Dashboard Setter</h1>
                <p className="text-gray-600 mt-1">Consulta tus comisiones</p>
            </div>

            <Card className="rounded-2xl border-gray-200 shadow-md">
                <CardHeader>
                    <CardTitle>Bienvenido</CardTitle>
                    <CardDescription>Dashboard en construcción</CardDescription>
                </CardHeader>
                <CardContent>
                    <p className="text-gray-600">
                        Próximamente: Resumen de tus comisiones generadas.
                    </p>
                </CardContent>
            </Card>
        </div>
    );
}
