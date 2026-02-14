'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default function LoginPage() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const router = useRouter();
    const handleLogin = async (e: React.FormEvent) => {
        const supabase = createClient();
        e.preventDefault();
        setLoading(true);
        setError(null);

        console.log('🔐 Intentando login con:', email);

        try {
            const { data, error: signInError } = await supabase.auth.signInWithPassword({
                email,
                password,
            });

            if (signInError) {
                console.error('❌ Error de autenticación:', signInError);
                setError(signInError.message);
                setLoading(false);
                return;
            }

            if (data.user) {
                console.log('✅ Usuario autenticado:', data.user.id);

                // Obtener el rol del usuario
                const { data: profile, error: profileError } = await supabase
                    .from('profiles')
                    .select('role')
                    .eq('id', data.user.id)
                    .single();

                if (profileError) {
                    console.error('❌ Error obteniendo perfil:', profileError);
                    setError('Error al obtener el perfil del usuario');
                    setLoading(false);
                    return;
                }

                console.log('👤 Perfil encontrado:', profile);

                // Redirigir según el rol
                if (profile && typeof profile === 'object' && 'role' in profile) {
                    const userRole = (profile as any).role as string;
                    console.log('🚀 Redirigiendo a:', `/${userRole}`);

                    switch (userRole) {
                        case 'admin':
                            router.push('/admin');
                            break;
                        case 'closer':
                            router.push('/closer');
                            break;
                        case 'coach':
                            router.push('/coach');
                            break;
                        case 'setter':
                            router.push('/setter');
                            break;
                        default:
                            router.push('/admin');
                    }
                } else {
                    setError('No se pudo determinar el rol del usuario');
                    setLoading(false);
                }
            }
        } catch (err) {
            console.error('❌ Error inesperado:', err);
            setError('Error al iniciar sesión. Por favor, inténtalo de nuevo.');
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50">
            <Card className="w-full max-w-md rounded-xl shadow-sm border-gray-200">
                <CardHeader className="space-y-1 text-center pb-6">
                    <div className="mb-4">
                        <div className="w-14 h-14 bg-primary-700 rounded-xl mx-auto flex items-center justify-center shadow-sm">
                            <span className="text-xl font-bold text-white">PM</span>
                        </div>
                    </div>
                    <CardTitle className="text-2xl font-semibold text-gray-900">PayMang</CardTitle>
                    <CardDescription className="text-sm text-gray-600">
                        Gestión de comisiones y ventas
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <form onSubmit={handleLogin} className="space-y-4">
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
                        <div className="space-y-2">
                            <Label htmlFor="password" className="text-sm font-medium text-gray-700">
                                Contraseña
                            </Label>
                            <Input
                                id="password"
                                type="password"
                                placeholder="••••••••"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
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
                            {loading ? 'Iniciando sesión...' : 'Iniciar Sesión'}
                        </Button>
                    </form>
                </CardContent>
            </Card>
        </div>
    );
}
