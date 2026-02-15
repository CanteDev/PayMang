'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { CheckCircle, Lock } from 'lucide-react';

export default function UpdatePasswordPage() {
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState(false);

    const router = useRouter();

    const handleUpdatePassword = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        if (password !== confirmPassword) {
            setError('Las contraseñas no coinciden');
            setLoading(false);
            return;
        }

        if (password.length < 6) {
            setError('La contraseña debe tener al menos 6 caracteres');
            setLoading(false);
            return;
        }

        const supabase = createClient();

        try {
            const { error } = await supabase.auth.updateUser({
                password: password
            });

            if (error) {
                console.error('Error updating password:', error);
                setError(error.message);
            } else {
                setSuccess(true);
                // Optional: Redirect after a few seconds
                setTimeout(() => {
                    // Check role and redirect? Or just /login or /admin (if logged in)
                    // If session is active (which it should be after callback), we can redirect to home/dashboard
                    // But we don't know the role here easily without fetching profile.
                    // For now, redirect to root which handles role redirection usually or login
                    router.push('/');
                }, 2000);
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
                        {success ? 'Contraseña Actualizada' : 'Nueva Contraseña'}
                    </CardTitle>
                    <CardDescription className="text-sm text-gray-600">
                        {success
                            ? 'Tu contraseña ha sido actualizada correctamente.'
                            : 'Ingresa tu nueva contraseña para acceder a tu cuenta.'}
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    {success ? (
                        <div className="text-center space-y-6">
                            <div className="bg-green-50 text-green-700 p-4 rounded-lg flex flex-col items-center">
                                <CheckCircle className="h-10 w-10 mb-2 text-green-600" />
                                <p className="font-medium">¡Todo listo!</p>
                                <p className="text-sm mt-1">Redirigiendo al inicio...</p>
                            </div>
                        </div>
                    ) : (
                        <form onSubmit={handleUpdatePassword} className="space-y-4">
                            <div className="space-y-2">
                                <Label htmlFor="password" className="text-sm font-medium text-gray-700">
                                    Nueva Contraseña
                                </Label>
                                <Input
                                    id="password"
                                    type="password"
                                    placeholder="Mínimo 6 caracteres"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    required
                                    className="rounded-lg h-10"
                                    disabled={loading}
                                />
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="confirmPassword" className="text-sm font-medium text-gray-700">
                                    Confirmar Contraseña
                                </Label>
                                <Input
                                    id="confirmPassword"
                                    type="password"
                                    placeholder="Repite la contraseña"
                                    value={confirmPassword}
                                    onChange={(e) => setConfirmPassword(e.target.value)}
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
                                {loading ? 'Actualizando...' : 'Guardar Contraseña'}
                            </Button>
                        </form>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
