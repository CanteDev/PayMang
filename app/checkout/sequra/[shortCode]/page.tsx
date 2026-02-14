'use client';

import { useEffect, useState, useRef } from 'react';
import { useParams } from 'next/navigation';
import { initiateSequraPayment } from '@/app/actions/sequra';
import { Loader2, AlertCircle } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

export default function SequraCheckoutPage() {
    const params = useParams();
    const shortCode = params.shortCode as string;

    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [formHtml, setFormHtml] = useState<string | null>(null);

    const initialized = useRef(false);

    useEffect(() => {
        if (initialized.current) return;
        initialized.current = true;

        const startCheckout = async () => {
            try {
                const result = await initiateSequraPayment(shortCode);
                setFormHtml(result.form);

                // Execute Sequra Scripts if present in HTML
                // React dangerouslySetInnerHTML doesn't execute scripts.
                // We need to manually inject them.
            } catch (err: any) {
                console.error('Checkout error:', err);
                setError(err.message || 'Error iniciando el pago con Sequra');
            } finally {
                setLoading(false);
            }
        };

        if (shortCode) {
            startCheckout();
        }
    }, [shortCode]);

    // Helper to execute scripts in the form HTML
    useEffect(() => {
        if (formHtml) {
            // Create a range to parse HTML
            const range = document.createRange();
            range.selectNode(document.body);
            const fragment = range.createContextualFragment(formHtml);

            const container = document.getElementById('sequra-form-container');
            if (container) {
                container.innerHTML = '';
                container.appendChild(fragment);
            }
        }
    }, [formHtml]);

    if (loading) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50">
                <Loader2 className="w-12 h-12 text-blue-600 animate-spin mb-4" />
                <p className="text-gray-600 font-medium">Iniciando conexión con Sequra...</p>
            </div>
        );
    }

    if (error) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
                <Alert variant="destructive" className="max-w-md">
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>Error</AlertTitle>
                    <AlertDescription>{error}</AlertDescription>
                </Alert>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">
            <div id="sequra-form-container" className="w-full max-w-4xl bg-white rounded-xl shadow-lg min-h-[600px] flex flex-col relative overflow-hidden">
                {/* Form will be injected here */}
            </div>
            <p className="mt-4 text-xs text-gray-400">
                Pago seguro procesado por SeQura
            </p>
        </div>
    );
}
