import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default function CoachDashboard() {
    return (
        <div className="space-y-8">
            <div>
                <h1 className="text-3xl font-bold text-gray-900">Dashboard Coach</h1>
                <p className="text-gray-600 mt-1">Gestiona tus alumnos y comisiones</p>
            </div>

            <Card className="rounded-2xl border-gray-200 shadow-md">
                <CardHeader>
                    <CardTitle>Bienvenido</CardTitle>
                    <CardDescription>Dashboard en construcción</CardDescription>
                </CardHeader>
                <CardContent>
                    <p className="text-gray-600">
                        Próximamente: Resumen de tus alumnos asignados y comisiones.
                    </p>
                </CardContent>
            </Card>
        </div>
    );
}
