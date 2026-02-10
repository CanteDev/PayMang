import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertCircle } from 'lucide-react';

export default function AdminIncidencesPage() {
    return (
        <div className="space-y-8">
            <div>
                <h1 className="text-3xl font-semibold text-gray-900">Incidencias</h1>
                <p className="text-gray-600 mt-1">Gestión de disputas y errores en pagos</p>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center space-x-2">
                        <AlertCircle className="w-5 h-5" />
                        <span>Listado de Incidencias</span>
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="text-center py-10 text-gray-500">
                        <p>Gestión de incidencias en construcción...</p>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
