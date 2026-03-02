'use client';

import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import { CheckCircle } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';

/**
 * Página de retorno post-pago SeQura (return_url)
 * 
 * SeQura redirige al alumno aquí tras completar el formulario de identificación.
 * El pago puede no estar 100% confirmado en este momento — la confirmación definitiva
 * llega via IPN (notify_url) de forma asíncrona.
 */
function SeQuraConfirmedContent() {
    const searchParams = useSearchParams();
    const linkId = searchParams.get('link');

    return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-4">
            <div className="max-w-md w-full bg-white/10 backdrop-blur-sm border border-white/20 rounded-2xl p-8 text-center shadow-2xl">
                {/* Icono de éxito */}
                <div className="flex justify-center mb-6">
                    <div className="w-20 h-20 bg-green-500/20 rounded-full flex items-center justify-center">
                        <CheckCircle className="w-12 h-12 text-green-400" />
                    </div>
                </div>

                {/* Título */}
                <h1 className="text-2xl font-bold text-white mb-3">
                    ¡Solicitud Recibida!
                </h1>

                {/* Descripción */}
                <p className="text-slate-300 mb-2 leading-relaxed">
                    Tu solicitud de financiación con SeQura ha sido enviada correctamente.
                </p>
                <p className="text-slate-400 text-sm mb-6 leading-relaxed">
                    SeQura evaluará tu solicitud y recibirás una confirmación por correo electrónico.
                    El acceso a tu programa se activará automáticamente una vez confirmado el pago.
                </p>

                {/* Info adicional */}
                <div className="bg-white/5 border border-white/10 rounded-xl p-4 mb-6 text-left">
                    <p className="text-xs text-slate-400 font-medium uppercase tracking-wider mb-2">
                        ¿Qué ocurre ahora?
                    </p>
                    <ol className="text-sm text-slate-300 space-y-1">
                        <li>1. SeQura revisa tu solicitud (puede tardar unos minutos)</li>
                        <li>2. Recibirás un email de confirmación de SeQura</li>
                        <li>3. Se activará tu acceso automáticamente</li>
                    </ol>
                </div>

                {/* Referencia */}
                {linkId && (
                    <p className="text-xs text-slate-500 mb-6">
                        Referencia de tu pedido: <span className="font-mono text-slate-400">{linkId}</span>
                    </p>
                )}

                {/* Botón */}
                <Link href="/">
                    <Button className="w-full bg-white/10 hover:bg-white/20 text-white border border-white/20">
                        Volver al inicio
                    </Button>
                </Link>
            </div>
        </div>
    );
}

export default function SeQuraConfirmedPage() {
    return (
        <Suspense fallback={
            <div className="min-h-screen flex items-center justify-center bg-slate-900">
                <div className="text-white">Procesando...</div>
            </div>
        }>
            <SeQuraConfirmedContent />
        </Suspense>
    );
}
