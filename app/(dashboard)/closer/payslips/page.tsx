'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import CommissionTable from '@/components/dashboard/CommissionTable';

export default function CloserPayslipsPage() {
    const [userId, setUserId] = useState<string | null>(null);
    const supabase = createClient();

    useEffect(() => {
        const getUser = async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (user) setUserId(user.id);
        };
        getUser();
    }, []);

    if (!userId) return <div className="p-8">Cargando...</div>;

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-semibold text-gray-900">Mis Liquidaciones</h1>
                <p className="text-gray-600 mt-1">Comisiones pagadas y validadas</p>
            </div>
            {/* Payslips usually show paid stuff. We can reuse CommissionTable or create a specific one. 
                For now reusing CommissionTable as it covers the requirement appropriately. */}
            <CommissionTable userRole="closer" userId={userId} />
        </div>
    );
}
