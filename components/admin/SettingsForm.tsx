'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { updateSetting } from '@/app/actions/settings';
import { processStripeSync, processHotmartSync } from '@/app/actions/sync';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { Eye, EyeOff, RefreshCw } from 'lucide-react';
import { useSearchParams } from 'next/navigation';

interface SettingsFormProps {
    settings: any[];
}

export default function SettingsForm({ settings }: SettingsFormProps) {
    const [localSettings, setLocalSettings] = useState<any[]>(settings);
    const [loading, setLoading] = useState<string | null>(null);
    const [syncLoading, setSyncLoading] = useState<string | null>(null);

    const searchParams = useSearchParams();
    const tabParam = searchParams.get('tab');
    const [activeTab, setActiveTab] = useState(tabParam || 'business');

    const [showPasswords, setShowPasswords] = useState<Record<string, boolean>>({});

    const togglePassword = (fieldId: string) => {
        setShowPasswords(prev => ({ ...prev, [fieldId]: !prev[fieldId] }));
    };

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
            const valueToSave = setting ? setting.value : {};

            // Determinar categoría por defecto basada en la clave
            let category = 'system';
            if (['commission_rates', 'sequra_milestones'].includes(key)) category = 'business';
            if (['stripe_config', 'hotmart_config', 'sequra_config'].includes(key)) category = 'payment';

            await updateSetting(category, key, valueToSave);
            toast.success('Configuración guardada correctamente');
        } catch (error) {
            console.error(error);
            toast.error('Error al guardar la configuración');
        } finally {
            setLoading(null);
        }
    };

    const handleSync = async (gateway: 'stripe' | 'hotmart') => {
        setSyncLoading(gateway);
        toast.info(`Iniciando sincronización de ${gateway}...`);
        try {
            let res;
            if (gateway === 'stripe') {
                res = await processStripeSync();
            } else if (gateway === 'hotmart') {
                res = await processHotmartSync();
            }
            if (res && res.success) {
                const sRes = res as any;
                toast.success(<div className="flex flex-col gap-1">
                    <span>Sincronización completada</span>
                    <span className="text-xs opacity-90">{sRes.newCount} añadidos, {sRes.updatedCount} actualizados, {sRes.deactivatedCount} desactivados.</span>
                </div>);
            } else if (res && !res.success) {
                toast.error(`Error de la pasarela: ${(res as any).error}`);
            }
        } catch (error: any) {
            console.error(error);
            toast.error(`Error sincronizando ${gateway}: ${error.message}`);
        } finally {
            setSyncLoading(null);
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
                                    <div className="relative">
                                        <Input
                                            type={showPasswords['stripe_pk'] ? "text" : "password"}
                                            value={stripeConfig.PUBLISHABLE_KEY || stripeConfig.publishable_key || ''}
                                            onChange={e => handleUpdate('stripe_config', { ...stripeConfig, PUBLISHABLE_KEY: e.target.value })}
                                            placeholder="pk_test_..."
                                            className="pr-10"
                                        />
                                        <button
                                            type="button"
                                            onClick={() => togglePassword('stripe_pk')}
                                            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                                        >
                                            {showPasswords['stripe_pk'] ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                        </button>
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <Label>Secret Key</Label>
                                    <div className="relative">
                                        <Input
                                            type={showPasswords['stripe_sk'] ? "text" : "password"}
                                            value={stripeConfig.SECRET_KEY || stripeConfig.secret_key || ''}
                                            onChange={e => handleUpdate('stripe_config', { ...stripeConfig, SECRET_KEY: e.target.value })}
                                            placeholder="sk_test_..."
                                            className="pr-10"
                                        />
                                        <button
                                            type="button"
                                            onClick={() => togglePassword('stripe_sk')}
                                            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                                        >
                                            {showPasswords['stripe_sk'] ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                        </button>
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <Label>Webhook Secret</Label>
                                    <div className="relative">
                                        <Input
                                            type={showPasswords['stripe_wh'] ? "text" : "password"}
                                            value={stripeConfig.WEBHOOK_SECRET || stripeConfig.webhook_secret || ''}
                                            onChange={e => handleUpdate('stripe_config', { ...stripeConfig, WEBHOOK_SECRET: e.target.value })}
                                            placeholder="whsec_..."
                                            className="pr-10"
                                        />
                                        <button
                                            type="button"
                                            onClick={() => togglePassword('stripe_wh')}
                                            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                                        >
                                            {showPasswords['stripe_wh'] ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                        </button>
                                    </div>
                                </div>
                                <div className="flex gap-3 pt-2">
                                    <Button
                                        onClick={() => handleSave('stripe_config')}
                                        disabled={loading === 'stripe_config'}
                                    >
                                        {loading === 'stripe_config' ? 'Guardando...' : 'Guardar Stripe'}
                                    </Button>
                                    <Button
                                        variant="outline"
                                        onClick={() => handleSync('stripe')}
                                        disabled={syncLoading === 'stripe'}
                                    >
                                        <RefreshCw className={cn("mr-2 h-4 w-4", syncLoading === 'stripe' && "animate-spin")} />
                                        {syncLoading === 'stripe' ? 'Sincronizando...' : 'Sincronizar Productos'}
                                    </Button>
                                </div>
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
                                    <div className="relative">
                                        <Input
                                            type={showPasswords['hotmart_cid'] ? "text" : "password"}
                                            value={hotmartConfig.CLIENT_ID || hotmartConfig.client_id || ''}
                                            onChange={e => handleUpdate('hotmart_config', { ...hotmartConfig, CLIENT_ID: e.target.value })}
                                            className="pr-10"
                                        />
                                        <button
                                            type="button"
                                            onClick={() => togglePassword('hotmart_cid')}
                                            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                                        >
                                            {showPasswords['hotmart_cid'] ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                        </button>
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <Label>Client Secret</Label>
                                    <div className="relative">
                                        <Input
                                            type={showPasswords['hotmart_sec'] ? "text" : "password"}
                                            value={hotmartConfig.CLIENT_SECRET || hotmartConfig.client_secret || ''}
                                            onChange={e => handleUpdate('hotmart_config', { ...hotmartConfig, CLIENT_SECRET: e.target.value })}
                                            className="pr-10"
                                        />
                                        <button
                                            type="button"
                                            onClick={() => togglePassword('hotmart_sec')}
                                            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                                        >
                                            {showPasswords['hotmart_sec'] ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                        </button>
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <Label>Basic Auth Token</Label>
                                    <div className="relative">
                                        <Input
                                            type={showPasswords['hotmart_auth'] ? "text" : "password"}
                                            value={hotmartConfig.BASIC_AUTH || hotmartConfig.basic_auth || ''}
                                            onChange={e => handleUpdate('hotmart_config', { ...hotmartConfig, BASIC_AUTH: e.target.value })}
                                            className="pr-10"
                                        />
                                        <button
                                            type="button"
                                            onClick={() => togglePassword('hotmart_auth')}
                                            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                                        >
                                            {showPasswords['hotmart_auth'] ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                        </button>
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <Label>Webhook Secret (Hottok)</Label>
                                    <div className="relative">
                                        <Input
                                            type={showPasswords['hotmart_wh'] ? "text" : "password"}
                                            value={hotmartConfig.WEBHOOK_SECRET || hotmartConfig.webhook_secret || ''}
                                            onChange={e => handleUpdate('hotmart_config', { ...hotmartConfig, WEBHOOK_SECRET: e.target.value })}
                                            className="pr-10"
                                        />
                                        <button
                                            type="button"
                                            onClick={() => togglePassword('hotmart_wh')}
                                            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                                        >
                                            {showPasswords['hotmart_wh'] ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                        </button>
                                    </div>
                                </div>
                                <div className="flex gap-3 pt-2">
                                    <Button
                                        onClick={() => handleSave('hotmart_config')}
                                        disabled={loading === 'hotmart_config'}
                                    >
                                        {loading === 'hotmart_config' ? 'Guardando...' : 'Guardar Hotmart'}
                                    </Button>
                                    <Button
                                        variant="outline"
                                        onClick={() => handleSync('hotmart')}
                                        disabled={syncLoading === 'hotmart'}
                                    >
                                        <RefreshCw className={cn("mr-2 h-4 w-4", syncLoading === 'hotmart' && "animate-spin")} />
                                        {syncLoading === 'hotmart' ? 'Sincronizando...' : 'Sincronizar Productos'}
                                    </Button>
                                </div>
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
                                        value={sequraConfig.MERCHANT_ID || sequraConfig.merchant_id || ''}
                                        onChange={e => handleUpdate('sequra_config', { ...sequraConfig, MERCHANT_ID: e.target.value })}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label>API Key / Asset Token</Label>
                                    <div className="relative">
                                        <Input
                                            type={showPasswords['sequra_api'] ? "text" : "password"}
                                            value={sequraConfig.API_KEY || sequraConfig.api_key || ''}
                                            onChange={e => handleUpdate('sequra_config', { ...sequraConfig, API_KEY: e.target.value })}
                                            className="pr-10"
                                        />
                                        <button
                                            type="button"
                                            onClick={() => togglePassword('sequra_api')}
                                            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                                        >
                                            {showPasswords['sequra_api'] ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                        </button>
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <Label>Entorno</Label>
                                    <select
                                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                                        value={sequraConfig.ENVIRONMENT || sequraConfig.environment || 'sandbox'}
                                        onChange={e => handleUpdate('sequra_config', { ...sequraConfig, ENVIRONMENT: e.target.value })}
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
