import { fetchSettings } from '@/app/actions/settings';
import SettingsForm from '@/components/admin/SettingsForm';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export const dynamic = 'force-dynamic';

export default async function SettingsPage() {
    const settings = await fetchSettings();

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-bold tracking-tight">Configuración</h1>
                <p className="text-muted-foreground">
                    Gestiona los parámetros globales de la aplicación.
                </p>
            </div>

            <SettingsForm settings={settings || []} />
        </div>
    );
}
