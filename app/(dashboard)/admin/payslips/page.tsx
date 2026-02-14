'use client';

import CommissionTable from '@/components/dashboard/CommissionTable';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { FileText } from 'lucide-react';

export default function AdminPayslipsPage() {
    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-semibold text-gray-900">Comisiones</h1>
                <p className="text-gray-600 mt-1">Gestión de comisiones y pagos a agentes</p>
            </div>

            {/* We can use the existing CommissionTable which is robust enough for now */}
            <CommissionTable userRole="admin" />
        </div>
    );
}
