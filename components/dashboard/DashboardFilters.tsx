'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Calendar } from 'lucide-react';

export default function DashboardFilters() {
    const router = useRouter();
    const searchParams = useSearchParams();

    const [from, setFrom] = useState(searchParams.get('from') || '');
    const [to, setTo] = useState(searchParams.get('to') || '');

    const handleFilter = () => {
        const params = new URLSearchParams(searchParams.toString());
        if (from) params.set('from', from);
        else params.delete('from');

        if (to) params.set('to', to);
        else params.delete('to');

        router.push(`?${params.toString()}`);
    };

    const handleClear = () => {
        setFrom('');
        setTo('');
        router.push('/admin');
    };

    return (
        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex flex-col md:flex-row items-end gap-4 mb-6">
            <div className="flex-1 space-y-1.5">
                <Label htmlFor="from" className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Desde</Label>
                <div className="relative">
                    <Calendar className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                    <Input
                        id="from"
                        type="date"
                        value={from}
                        onChange={(e) => setFrom(e.target.value)}
                        className="pl-10 h-10 border-gray-200 focus:ring-primary-500"
                    />
                </div>
            </div>

            <div className="flex-1 space-y-1.5">
                <Label htmlFor="to" className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Hasta</Label>
                <div className="relative">
                    <Calendar className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                    <Input
                        id="to"
                        type="date"
                        value={to}
                        onChange={(e) => setTo(e.target.value)}
                        className="pl-10 h-10 border-gray-200 focus:ring-primary-500"
                    />
                </div>
            </div>

            <div className="flex gap-2">
                <Button
                    onClick={handleFilter}
                    className="h-10 px-6 bg-primary-600 hover:bg-primary-700 text-white font-medium transition-all"
                >
                    Filtrar
                </Button>
                {(from || to) && (
                    <Button
                        variant="ghost"
                        onClick={handleClear}
                        className="h-10 px-4 text-gray-500 hover:text-gray-700"
                    >
                        Limpiar
                    </Button>
                )}
            </div>
        </div>
    );
}
