'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { updateSetting } from '@/app/actions/settings';
import { toast } from 'sonner';

interface SettingsFormProps {
    settings: any[];
}

export default function SettingsForm({ settings }: SettingsFormProps) {
    const [localSettings, setLocalSettings] = useState<any[]>(settings);
    const [loading, setLoading] = useState<string | null>(null);

    const getSetting = (key: string) => localSettings.find(s => s.key === key)?.value || {};

    const handleUpdate = (key: string, newValue: any) => {
        setLocalSettings(prev => prev.map(s => s.key === key ? { ...s, value: newValue } : s));
    };

    const handleSave = async (key: string) => {
        setLoading(key);
        try {
            const setting = localSettings.find(s => s.key === key);
            await updateSetting(key, setting.value);
            toast.success('Configuración guardada correctamente');
        } catch (error) {
            console.error(error);
            toast.error('Error al guardar la configuración');
        } finally {
            setLoading(null);
        }
    };

    // Helper components for specific settings
    const CommissionRates = () => {
        const key = 'commission_rates';
        const value = getSetting(key);

        return (
            <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="space-y-2">
                        <Label>Coach (%)</Label>
                        <Input
                            type="number"
                            step="0.01"
                            className="w-32"
                            value={value.coach || 0}
                            onChange={e => handleUpdate(key, { ...value, coach: parseFloat(e.target.value) })}
                        />
                    </div>
                    <div className="space-y-2">
                        <Label>Closer (%)</Label>
                        <Input
                            type="number"
                            step="0.01"
                            className="w-32"
                            value={value.closer || 0}
                            onChange={e => handleUpdate(key, { ...value, closer: parseFloat(e.target.value) })}
                        />
                    </div>
                    <div className="space-y-2">
                        <Label>Setter (%)</Label>
                        <Input
                            type="number"
                            step="0.01"
                            className="w-32"
                            value={value.setter || 0}
                            onChange={e => handleUpdate(key, { ...value, setter: parseFloat(e.target.value) })}
                        />
                    </div>
                </div>
                <Button
                    onClick={() => handleSave(key)}
                    disabled={loading === key}
                >
                    {loading === key ? 'Guardando...' : 'Guardar Comisiones'}
                </Button>
            </div>
        );
    };

    const SequraMilestones = () => {
        const key = 'sequra_milestones';
        const value = getSetting(key);

        return (
            <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="space-y-2">
                        <Label>Hito 1 (Inicial) %</Label>
                        <Input
                            type="number"
                            step="0.01"
                            className="w-32"
                            value={value.initial || 0}
                            onChange={e => handleUpdate(key, { ...value, initial: parseFloat(e.target.value) })}
                        />
                    </div>
                    <div className="space-y-2">
                        <Label>Hito 2 %</Label>
                        <Input
                            type="number"
                            step="0.01"
                            className="w-32"
                            value={value.second || 0}
                            onChange={e => handleUpdate(key, { ...value, second: parseFloat(e.target.value) })}
                        />
                    </div>
                    <div className="space-y-2">
                        <Label>Hito 3 (Final) %</Label>
                        <Input
                            type="number"
                            step="0.01"
                            className="w-32"
                            value={value.final || 0}
                            onChange={e => handleUpdate(key, { ...value, final: parseFloat(e.target.value) })}
                        />
                    </div>
                </div>
                <Button
                    onClick={() => handleSave(key)}
                    disabled={loading === key}
                >
                    {loading === key ? 'Guardando...' : 'Guardar Hitos'}
                </Button>
            </div>
        );
    };

    const CompanyInfo = () => {
        const key = 'company_info';
        const value = getSetting(key);

        return (
            <div className="space-y-4">
                <div className="space-y-2">
                    <Label>Nombre de la Empresa</Label>
                    <Input
                        value={value.name || ''}
                        onChange={e => handleUpdate(key, { ...value, name: e.target.value })}
                    />
                </div>
                <div className="space-y-2">
                    <Label>Moneda</Label>
                    <Input
                        value={value.currency || 'EUR'}
                        onChange={e => handleUpdate(key, { ...value, currency: e.target.value })}
                    />
                </div>
                <Button
                    onClick={() => handleSave(key)}
                    disabled={loading === key}
                >
                    {loading === key ? 'Guardando...' : 'Guardar Información'}
                </Button>
            </div>
        );
    };

    const StripeConfig = () => {
        const key = 'stripe_config';
        const value = getSetting(key);

        return (
            <div className="space-y-4">
                <div className="space-y-2">
                    <Label>Publishable Key</Label>
                    <Input
                        type="password"
                        value={value.publishable_key || ''}
                        onChange={e => handleUpdate(key, { ...value, publishable_key: e.target.value })}
                        placeholder="pk_test_..."
                    />
                </div>
                <div className="space-y-2">
                    <Label>Secret Key</Label>
                    <Input
                        type="password"
                        value={value.secret_key || ''}
                        onChange={e => handleUpdate(key, { ...value, secret_key: e.target.value })}
                        placeholder="sk_test_..."
                    />
                </div>
                <div className="space-y-2">
                    <Label>Webhook Secret</Label>
                    <Input
                        type="password"
                        value={value.webhook_secret || ''}
                        onChange={e => handleUpdate(key, { ...value, webhook_secret: e.target.value })}
                        placeholder="whsec_..."
                    />
                </div>
                <Button
                    onClick={() => handleSave(key)}
                    disabled={loading === key}
                >
                    {loading === key ? 'Guardando...' : 'Guardar Stripe'}
                </Button>
            </div>
        );
    };

    const HotmartConfig = () => {
        const key = 'hotmart_config';
        const value = getSetting(key);

        return (
            <div className="space-y-4">
                <div className="space-y-2">
                    <Label>Client ID</Label>
                    <Input
                        value={value.client_id || ''}
                        onChange={e => handleUpdate(key, { ...value, client_id: e.target.value })}
                    />
                </div>
                <div className="space-y-2">
                    <Label>Client Secret</Label>
                    <Input
                        type="password"
                        value={value.client_secret || ''}
                        onChange={e => handleUpdate(key, { ...value, client_secret: e.target.value })}
                    />
                </div>
                <div className="space-y-2">
                    <Label>Basic Auth Token</Label>
                    <Input
                        type="password"
                        value={value.basic_auth || ''}
                        onChange={e => handleUpdate(key, { ...value, basic_auth: e.target.value })}
                    />
                </div>
                <div className="space-y-2">
                    <Label>Webhook Secret (Hottok)</Label>
                    <Input
                        type="password"
                        value={value.webhook_secret || ''}
                        onChange={e => handleUpdate(key, { ...value, webhook_secret: e.target.value })}
                    />
                </div>
                <Button
                    onClick={() => handleSave(key)}
                    disabled={loading === key}
                >
                    {loading === key ? 'Guardando...' : 'Guardar Hotmart'}
                </Button>
            </div>
        );
    };

    const SequraConfig = () => {
        const key = 'sequra_config';
        const value = getSetting(key);

        return (
            <div className="space-y-4">
                <div className="space-y-2">
                    <Label>Merchant ID</Label>
                    <Input
                        value={value.merchant_id || ''}
                        onChange={e => handleUpdate(key, { ...value, merchant_id: e.target.value })}
                    />
                </div>
                <div className="space-y-2">
                    <Label>API Key / Asset Token</Label>
                    <Input
                        type="password"
                        value={value.api_key || ''}
                        onChange={e => handleUpdate(key, { ...value, api_key: e.target.value })}
                    />
                </div>
                <div className="space-y-2">
                    <Label>Entorno</Label>
                    <select
                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                        value={value.environment || 'sandbox'}
                        onChange={e => handleUpdate(key, { ...value, environment: e.target.value })}
                    >
                        <option value="sandbox">Sandbox (Pruebas)</option>
                        <option value="production">Producción</option>
                    </select>
                </div>
                <Button
                    onClick={() => handleSave(key)}
                    disabled={loading === key}
                >
                    {loading === key ? 'Guardando...' : 'Guardar SeQura'}
                </Button>
            </div>
        );
    };

    return (
        <Tabs defaultValue="business" className="w-full">
            <TabsList className="mb-4">
                <TabsTrigger value="business">Negocio</TabsTrigger>
                <TabsTrigger value="payment">Pasarelas</TabsTrigger>
                <TabsTrigger value="system">Sistema</TabsTrigger>
            </TabsList>

            <TabsContent value="business">
                <Card>
                    <CardHeader>
                        <CardTitle>Configuración de Negocio</CardTitle>
                        <CardDescription>Gestiona comisiones y reglas de pago.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-8">
                        <div>
                            <h3 className="text-lg font-medium mb-4">Comisiones</h3>
                            <CommissionRates />
                        </div>
                        <div className="border-t pt-6">
                            <h3 className="text-lg font-medium mb-4">SeQura</h3>
                            <SequraMilestones />
                        </div>
                    </CardContent>
                </Card>
            </TabsContent>

            <TabsContent value="system">
                <Card>
                    <CardHeader>
                        <CardTitle>Configuración del Sistema</CardTitle>
                        <CardDescription>Información general de la aplicación.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <CompanyInfo />
                    </CardContent>
                </Card>
            </TabsContent>

            <TabsContent value="payment">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <Card>
                        <CardHeader>
                            <CardTitle>Stripe</CardTitle>
                            <CardDescription>Pagos con tarjeta</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <StripeConfig />
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle>Hotmart</CardTitle>
                            <CardDescription>Plataforma de infoproductos</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <HotmartConfig />
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle>SeQura</CardTitle>
                            <CardDescription>Pago fraccionado</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <SequraConfig />
                        </CardContent>
                    </Card>
                </div>
            </TabsContent>
        </Tabs>
    );
}
