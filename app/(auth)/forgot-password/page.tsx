'use client';

import { useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { CONFIG } from '@/config/app.config';
import { ArrowLeft, CheckCircle } from 'lucide-react';

export default function ForgotPasswordPage() {
    const [email, setEmail] = useState('');
    const [loading, setLoading] = useState(false);
    const [success, setSuccess] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleResetPassword = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        const supabase = createClient();

        try {
            const { error } = await supabase.auth.resetPasswordForEmail(email, {
                redirectTo: `${CONFIG.APP.URL}/api/auth/callback?next=/update-password`,
            });

            if (error) {
                console.error('Error sending reset email:', error);
                setError(error.message);
            } else {
                setSuccess(true);
            }
        } catch (err: any) {
            console.error('Unexpected error:', err);
            setError('Error inesperado. Por favor intenta de nuevo.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
            <Card className="w-full max-w-md rounded-xl shadow-sm border-gray-200">
                <CardHeader className="space-y-1 text-center pb-6">
                    <div className="mb-4">
                        <div className="w-14 h-14 bg-primary-700 rounded-xl mx-auto flex items-center justify-center shadow-sm">
                            <span className="text-xl font-bold text-white">PM</span>
                        </div>
                    </div>
                    <CardTitle className="text-2xl font-semibold text-gray-900">
                        Recuperar Contraseña
                    </CardTitle>
                    <CardDescription className="text-sm text-gray-600">
                        Ingresa tu email para recibir un enlace de recuperación
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    {success ? (
                        <div className="text-center space-y-6">
                            <div className="bg-green-50 text-green-700 p-4 rounded-lg flex flex-col items-center">
                                <CheckCircle className="h-10 w-10 mb-2 text-green-600" />
                                <p className="font-medium">¡Correo enviado!</p>
                                <p className="text-sm mt-1">Revisa tu bandeja de entrada (y spam) para continuar.</p>
                            </div>
                            <Button asChild className="w-full" variant="outline">
                                <Link href="/login">
                                    <ArrowLeft className="mr-2 h-4 w-4" />
                                    Volver al Login
                                </Link>
                            </Button>
                        </div>
                    ) : (
                        <form onSubmit={handleResetPassword} className="space-y-4">
                            <div className="space-y-2">
                                <Label htmlFor="email" className="text-sm font-medium text-gray-700">
                                    Email
                                </Label>
                                <Input
                                    id="email"
                                    type="email"
                                    placeholder="tu@email.com"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    required
                                    className="rounded-lg h-10"
                                    disabled={loading}
                                />
                            </div>

                            {error && (
                                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
                                    {error}
                                </div>
                            )}

                            <Button
                                type="submit"
                                className="w-full h-10 rounded-lg bg-primary-700 hover:bg-primary-800 text-white font-medium shadow-sm transition-colors"
                                disabled={loading}
                            >
                                {loading ? 'Enviando...' : 'Enviar enlace'}
                            </Button>

                            <div className="text-center pt-2">
                                <Link href="/login" className="text-sm text-gray-500 hover:text-gray-700 flex items-center justify-center">
                                    <ArrowLeft className="mr-1 h-3 w-3" /> Volver al Login
                                </Link>
                            </div>
                        </form>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
