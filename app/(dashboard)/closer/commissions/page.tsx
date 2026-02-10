'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import CommissionTable from '@/components/dashboard/CommissionTable';

export default function CloserCommissionsPage() {
    const [userId, setUserId] = useState<string | null>(null);
    const supabase = createClient();

    useEffect(() => {
        const getUser = async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
                // Get profile id properly if different from auth id, but usually they match in this schema
                // or we query profiles using auth.uid()
                // Assuming profile.id = auth.uid()
                setUserId(user.id);
            }
        };
        getUser();
    }, []);

    if (!userId) return <div className="p-8">Cargando...</div>;

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-semibold text-gray-900">Mis Comisiones</h1>
                <p className="text-gray-600 mt-1">Historial de comisiones por cierres</p>
            </div>
            <CommissionTable userRole="closer" userId={userId} />
        </div>
    );
}
