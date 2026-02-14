'use client';

import React, { useEffect, useState } from 'react';
import {
    Card,
    CardContent,
    CardHeader,
    CardTitle
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
    AlertCircle,
    CheckCircle2,
    Wallet,
    ArrowRight
} from 'lucide-react';
import { getAlertCounts } from '@/app/actions/dashboard';
import Link from 'next/link';

interface AlertCounts {
    pendingPayouts?: number;
    newIncidences?: number;
    pendingValidations?: number;
}

interface DashboardAlertCardsProps {
    role: 'admin' | 'closer' | 'coach' | 'setter';
}

export default function DashboardAlertCards({ role }: DashboardAlertCardsProps) {
    const [counts, setCounts] = useState<AlertCounts | null>(null);

    useEffect(() => {
        const fetchCounts = async () => {
            const data = await getAlertCounts();
            setCounts(data);
        };
        fetchCounts();
    }, []);

    if (!counts) return null;

    const hasAdminAlerts = role === 'admin' && (counts.pendingPayouts! > 0 || counts.newIncidences! > 0);
    const hasStaffAlerts = role !== 'admin' && counts.pendingValidations! > 0;

    if (!hasAdminAlerts && !hasStaffAlerts) return null;

    return (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 mb-8">
            {role === 'admin' && counts.pendingPayouts! > 0 && (
                <Card className="bg-blue-50 border-blue-200">
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-medium text-blue-900">
                            Pagos Pendientes
                        </CardTitle>
                        <Wallet className="h-4 w-4 text-blue-600" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-blue-900">{counts.pendingPayouts}</div>
                        <p className="text-xs text-blue-700 mt-1">
                            Comisiones validadas listas para pagar
                        </p>
                        <Button asChild variant="link" className="px-0 text-blue-600 h-auto mt-2">
                            <Link href="/admin/payslips" className="flex items-center gap-1">
                                Ir a Liquidaciones <ArrowRight className="h-3 w-3" />
                            </Link>
                        </Button>
                    </CardContent>
                </Card>
            )}

            {role === 'admin' && counts.newIncidences! > 0 && (
                <Card className="bg-yellow-50 border-yellow-200">
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-medium text-yellow-900">
                            Incidencias Abiertas
                        </CardTitle>
                        <AlertCircle className="h-4 w-4 text-yellow-600" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-yellow-900">{counts.newIncidences}</div>
                        <p className="text-xs text-yellow-700 mt-1">
                            Requieren revisión y resolución
                        </p>
                        <Button asChild variant="link" className="px-0 text-yellow-600 h-auto mt-2">
                            <Link href="/admin/incidences" className="flex items-center gap-1">
                                Gestionar Incidencias <ArrowRight className="h-3 w-3" />
                            </Link>
                        </Button>
                    </CardContent>
                </Card>
            )}

            {role !== 'admin' && counts.pendingValidations! > 0 && (
                <Card className="bg-orange-50 border-orange-200">
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-medium text-orange-900">
                            Validaciones Pendientes
                        </CardTitle>
                        <CheckCircle2 className="h-4 w-4 text-orange-600" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-orange-900">
                            {counts.pendingValidations}
                        </div>
                        <p className="text-xs text-orange-700 mt-1">
                            Nuevas comisiones esperando tu validación
                        </p>
                        <Button asChild variant="link" className="px-0 text-orange-600 h-auto mt-2">
                            <Link href={`/${role}/commissions`} className="flex items-center gap-1">
                                Validar ahora <ArrowRight className="h-3 w-3" />
                            </Link>
                        </Button>
                    </CardContent>
                </Card>
            )}
        </div>
    );
}
