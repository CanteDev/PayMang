'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { updateSetting } from '@/app/actions/settings';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface SettingsFormProps {
    settings: any[];
}

export default function SettingsForm({ settings }: SettingsFormProps) {
    const [localSettings, setLocalSettings] = useState<any[]>(settings);
    const [loading, setLoading] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState('business');

    const getSetting = (key: string) => localSettings.find(s => s.key === key)?.value || {};

    const handleUpdate = (key: string, newValue: any) => {
        setLocalSettings(prev => {
            const exists = prev.some(s => s.key === key);
            if (exists) {
                return prev.map(s => s.key === key ? { ...s, value: newValue } : s);
            } else {
                return [...prev, { key, value: newValue }];
            }
        });
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

    const commissionRates = getSetting('commission_rates');
    const sequraMilestones = getSetting('sequra_milestones');
    const companyInfo = getSetting('company_info');
    const stripeConfig = getSetting('stripe_config');
    const hotmartConfig = getSetting('hotmart_config');
    const sequraConfig = getSetting('sequra_config');

    const tabs = [
        { id: 'business', label: 'Negocio' },
        { id: 'payment', label: 'Pasarelas' },
        { id: 'system', label: 'Sistema' },
    ];

    return (
        <div className="w-full">
            {/* Custom tab buttons */}
            <div className="inline-flex h-10 items-center justify-center rounded-md bg-muted p-1 text-muted-foreground mb-4">
                {tabs.map(tab => (
                    <button
                        key={tab.id}
                        type="button"
                        onClick={() => setActiveTab(tab.id)}
                        className={cn(
                            "inline-flex items-center justify-center whitespace-nowrap rounded-sm px-3 py-1.5 text-sm font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                            activeTab === tab.id
                                ? "bg-background text-foreground shadow-sm"
                                : "hover:bg-background/50"
                        )}
                    >
                        {tab.label}
                    </button>
                ))}
            </div>

            {/* Business Tab */}
            <div className={activeTab === 'business' ? '' : 'hidden'}>
                <Card>
                    <CardHeader>
                        <CardTitle>Configuración de Negocio</CardTitle>
                        <CardDescription>Gestiona comisiones y reglas de pago.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-8">
                        <div>
                            <h3 className="text-lg font-medium mb-4">Comisiones</h3>
                            <div className="space-y-4">
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    <div className="space-y-2">
                                        <Label>Coach (%)</Label>
                                        <Input
                                            type="number"
                                            step="0.01"
                                            className="w-32"
                                            value={commissionRates.coach || 0}
                                            onChange={e => handleUpdate('commission_rates', { ...commissionRates, coach: parseFloat(e.target.value) })}
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Closer (%)</Label>
                                        <Input
                                            type="number"
                                            step="0.01"
                                            className="w-32"
                                            value={commissionRates.closer || 0}
                                            onChange={e => handleUpdate('commission_rates', { ...commissionRates, closer: parseFloat(e.target.value) })}
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Setter (%)</Label>
                                        <Input
                                            type="number"
                                            step="0.01"
                                            className="w-32"
                                            value={commissionRates.setter || 0}
                                            onChange={e => handleUpdate('commission_rates', { ...commissionRates, setter: parseFloat(e.target.value) })}
                                        />
                                    </div>
                                </div>
                                <Button
                                    onClick={() => handleSave('commission_rates')}
                                    disabled={loading === 'commission_rates'}
                                >
                                    {loading === 'commission_rates' ? 'Guardando...' : 'Guardar Comisiones'}
                                </Button>
                            </div>
                        </div>
                        <div className="border-t pt-6">
                            <h3 className="text-lg font-medium mb-4">SeQura</h3>
                            <div className="space-y-4">
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    <div className="space-y-2">
                                        <Label>Hito 1 (Inicial) %</Label>
                                        <Input
                                            type="number"
                                            step="0.01"
                                            className="w-32"
                                            value={sequraMilestones.initial || 0}
                                            onChange={e => handleUpdate('sequra_milestones', { ...sequraMilestones, initial: parseFloat(e.target.value) })}
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Hito 2 %</Label>
                                        <Input
                                            type="number"
                                            step="0.01"
                                            className="w-32"
                                            value={sequraMilestones.second || 0}
                                            onChange={e => handleUpdate('sequra_milestones', { ...sequraMilestones, second: parseFloat(e.target.value) })}
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Hito 3 (Final) %</Label>
                                        <Input
                                            type="number"
                                            step="0.01"
                                            className="w-32"
                                            value={sequraMilestones.final || 0}
                                            onChange={e => handleUpdate('sequra_milestones', { ...sequraMilestones, final: parseFloat(e.target.value) })}
                                        />
                                    </div>
                                </div>
                                <Button
                                    onClick={() => handleSave('sequra_milestones')}
                                    disabled={loading === 'sequra_milestones'}
                                >
                                    {loading === 'sequra_milestones' ? 'Guardando...' : 'Guardar Hitos'}
                                </Button>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* System Tab */}
            <div className={activeTab === 'system' ? '' : 'hidden'}>
                <Card>
                    <CardHeader>
                        <CardTitle>Configuración del Sistema</CardTitle>
                        <CardDescription>Información general de la aplicación.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-4">
                            <div className="space-y-2">
                                <Label>Nombre de la Empresa</Label>
                                <Input
                                    value={companyInfo.name || ''}
                                    onChange={e => handleUpdate('company_info', { ...companyInfo, name: e.target.value })}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>Moneda</Label>
                                <Input
                                    value={companyInfo.currency || 'EUR'}
                                    onChange={e => handleUpdate('company_info', { ...companyInfo, currency: e.target.value })}
                                />
                            </div>
                            <Button
                                onClick={() => handleSave('company_info')}
                                disabled={loading === 'company_info'}
                            >
                                {loading === 'company_info' ? 'Guardando...' : 'Guardar Información'}
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Payment Tab */}
            <div className={activeTab === 'payment' ? '' : 'hidden'}>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <Card>
                        <CardHeader>
                            <CardTitle>Stripe</CardTitle>
                            <CardDescription>Pagos con tarjeta</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-4">
                                <div className="space-y-2">
                                    <Label>Publishable Key</Label>
                                    <Input
                                        type="password"
                                        value={stripeConfig.publishable_key || ''}
                                        onChange={e => handleUpdate('stripe_config', { ...stripeConfig, publishable_key: e.target.value })}
                                        placeholder="pk_test_..."
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label>Secret Key</Label>
                                    <Input
                                        type="password"
                                        value={stripeConfig.secret_key || ''}
                                        onChange={e => handleUpdate('stripe_config', { ...stripeConfig, secret_key: e.target.value })}
                                        placeholder="sk_test_..."
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label>Webhook Secret</Label>
                                    <Input
                                        type="password"
                                        value={stripeConfig.webhook_secret || ''}
                                        onChange={e => handleUpdate('stripe_config', { ...stripeConfig, webhook_secret: e.target.value })}
                                        placeholder="whsec_..."
                                    />
                                </div>
                                <Button
                                    onClick={() => handleSave('stripe_config')}
                                    disabled={loading === 'stripe_config'}
                                >
                                    {loading === 'stripe_config' ? 'Guardando...' : 'Guardar Stripe'}
                                </Button>
                            </div>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle>Hotmart</CardTitle>
                            <CardDescription>Plataforma de infoproductos</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-4">
                                <div className="space-y-2">
                                    <Label>Client ID</Label>
                                    <Input
                                        value={hotmartConfig.client_id || ''}
                                        onChange={e => handleUpdate('hotmart_config', { ...hotmartConfig, client_id: e.target.value })}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label>Client Secret</Label>
                                    <Input
                                        type="password"
                                        value={hotmartConfig.client_secret || ''}
                                        onChange={e => handleUpdate('hotmart_config', { ...hotmartConfig, client_secret: e.target.value })}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label>Basic Auth Token</Label>
                                    <Input
                                        type="password"
                                        value={hotmartConfig.basic_auth || ''}
                                        onChange={e => handleUpdate('hotmart_config', { ...hotmartConfig, basic_auth: e.target.value })}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label>Webhook Secret (Hottok)</Label>
                                    <Input
                                        type="password"
                                        value={hotmartConfig.webhook_secret || ''}
                                        onChange={e => handleUpdate('hotmart_config', { ...hotmartConfig, webhook_secret: e.target.value })}
                                    />
                                </div>
                                <Button
                                    onClick={() => handleSave('hotmart_config')}
                                    disabled={loading === 'hotmart_config'}
                                >
                                    {loading === 'hotmart_config' ? 'Guardando...' : 'Guardar Hotmart'}
                                </Button>
                            </div>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle>SeQura</CardTitle>
                            <CardDescription>Pago fraccionado</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-4">
                                <div className="space-y-2">
                                    <Label>Merchant ID</Label>
                                    <Input
                                        value={sequraConfig.merchant_id || ''}
                                        onChange={e => handleUpdate('sequra_config', { ...sequraConfig, merchant_id: e.target.value })}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label>API Key / Asset Token</Label>
                                    <Input
                                        type="password"
                                        value={sequraConfig.api_key || ''}
                                        onChange={e => handleUpdate('sequra_config', { ...sequraConfig, api_key: e.target.value })}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label>Entorno</Label>
                                    <select
                                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                                        value={sequraConfig.environment || 'sandbox'}
                                        onChange={e => handleUpdate('sequra_config', { ...sequraConfig, environment: e.target.value })}
                                    >
                                        <option value="sandbox">Sandbox (Pruebas)</option>
                                        <option value="production">Producción</option>
                                    </select>
                                </div>
                                <Button
                                    onClick={() => handleSave('sequra_config')}
                                    disabled={loading === 'sequra_config'}
                                >
                                    {loading === 'sequra_config' ? 'Guardando...' : 'Guardar SeQura'}
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
}
