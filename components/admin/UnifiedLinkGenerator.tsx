'use client';

import { useState, useEffect, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';
import { nanoid } from 'nanoid';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Copy, CheckCircle2, Send, UserPlus } from 'lucide-react';
import { CONFIG } from '@/config/app.config';
import StudentForm from '@/components/admin/StudentForm';

interface Student {
    id: string;
    email: string;
    full_name: string;
    assigned_coach_id: string | null;
    closer_id: string | null;
}

interface Pack {
    id: string;
    name: string;
    price: number;
    gateway_ids: any;
}

interface Profile {
    id: string;
    full_name: string;
    email: string;
    role: string;
}

export default function UnifiedLinkGenerator() {
    const [students, setStudents] = useState<Student[]>([]);
    const [packs, setPacks] = useState<Pack[]>([]);
    const [closers, setClosers] = useState<Profile[]>([]);
    const [setters, setSetters] = useState<Profile[]>([]);
    const [coaches, setCoaches] = useState<Profile[]>([]);

    const [selectedStudent, setSelectedStudent] = useState<string>('');
    const [selectedPack, setSelectedPack] = useState<string>('');
    const [selectedGateway, setSelectedGateway] = useState<string>('');
    const [selectedCloser, setSelectedCloser] = useState<string>('');
    const [selectedSetter, setSelectedSetter] = useState<string>('');

    const [generatedLink, setGeneratedLink] = useState<string>('');
    const [generatedLinkId, setGeneratedLinkId] = useState<string>('');
    const [copied, setCopied] = useState(false);
    const [loading, setLoading] = useState(false);
    const [simulatingPayment, setSimulatingPayment] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);

    const [availableGateways, setAvailableGateways] = useState<string[]>([]);
    const [assignedCoach, setAssignedCoach] = useState<string>('');

    const supabase = createClient();

    // Cargar datos iniciales
    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        try {
            // Cargar estudiantes
            const { data: studentsData } = await supabase
                .from('students')
                .select('*')
                .eq('status', 'active')
                .order('email');
            if (studentsData) setStudents(studentsData);

            // Cargar packs
            const { data: packsData } = await supabase
                .from('packs')
                .select('*')
                .eq('is_active', true)
                .order('name');
            if (packsData) setPacks(packsData);

            // Cargar closers
            const { data: closersData } = await supabase
                .from('profiles')
                .select('*')
                .eq('role', 'closer')
                .eq('is_active', true)
                .order('full_name');
            if (closersData) setClosers(closersData);

            // Cargar setters
            const { data: settersData } = await supabase
                .from('profiles')
                .select('*')
                .eq('role', 'setter')
                .eq('is_active', true)
                .order('full_name');
            if (settersData) setSetters(settersData);
        } catch (err) {
            console.error('Error cargando datos:', err);
        }
    };

    const prevSelectedStudentRef = useRef<string>('');

    // Actualizar info cuando cambia el estudiante
    useEffect(() => {
        // Solo actualizar si el estudiante seleccionado ha cambiado
        if (selectedStudent && selectedStudent !== prevSelectedStudentRef.current) {
            const student = students.find(s => s.id === selectedStudent);
            if (student) {
                // Autocompletar coach si está asignado
                if (student.assigned_coach_id) {
                    setAssignedCoach(student.assigned_coach_id);
                } else {
                    setAssignedCoach('');
                }

                // Autocompletar closer si está asignado
                if (student.closer_id) {
                    setSelectedCloser(student.closer_id);
                } else {
                    setSelectedCloser('');
                }
            }
            prevSelectedStudentRef.current = selectedStudent;
        } else if (!selectedStudent && prevSelectedStudentRef.current) {
            // Reset cuando se deselecciona
            setAssignedCoach('');
            setSelectedCloser('');
            prevSelectedStudentRef.current = '';
        }
    }, [selectedStudent, students]);

    // Added: Load coaches when component mounts or as needed
    const loadCoaches = async () => {
        const { data: coachesData } = await supabase
            .from('profiles')
            .select('*')
            .eq('role', 'coach')
            .eq('is_active', true)
            .order('full_name');
        if (coachesData) setCoaches(coachesData);
    };

    useEffect(() => {
        loadCoaches();
    }, []);

    // Actualizar pasarelas disponibles cuando cambia el pack
    useEffect(() => {
        if (selectedPack) {
            const pack = packs.find(p => p.id === selectedPack);
            if (pack?.gateway_ids) {
                const gateways = [];
                // New: direct payment links
                if (pack.gateway_ids.stripe_link || pack.gateway_ids.stripe_prod_id || pack.gateway_ids.stripe) gateways.push('stripe');
                if (pack.gateway_ids.hotmart_link || pack.gateway_ids.hotmart_prod_id || pack.gateway_ids.hotmart) gateways.push('hotmart');
                if (pack.gateway_ids.sequra_link || pack.gateway_ids.sequra_merchant_id || pack.gateway_ids.sequra) gateways.push('sequra');

                setAvailableGateways(gateways);
                setSelectedGateway(''); // Reset gateway selection
            }
        }
    }, [selectedPack, packs]);

    const handleGenerateLink = async () => {
        setError(null);
        setLoading(true);

        // Validaciones
        if (!selectedStudent || !selectedPack || !selectedGateway || !selectedCloser) {
            setError('Por favor completa todos los campos obligatorios');
            setLoading(false);
            return;
        }

        if (!assignedCoach) {
            setError('El estudiante seleccionado no tiene coach asignado');
            setLoading(false);
            return;
        }

        try {
            // Si el estudiante no tenía coach asignado y seleccionamos uno ahora, lo asignamos
            const student = students.find(s => s.id === selectedStudent);
            if (student && !student.assigned_coach_id && assignedCoach) {
                const { error: updateError } = await (supabase
                    .from('students') as any)
                    .update({ assigned_coach_id: assignedCoach } as any)
                    .eq('id', selectedStudent);

                if (updateError) {
                    console.error('Error asignando coach:', updateError);
                    // No bloqueamos la generación del link, pero avisamos? 
                    // O quizás sí deberíamos bloquear. Por ahora solo log.
                } else {
                    // Actualizamos el estado local
                    setStudents(prev => prev.map(s =>
                        s.id === selectedStudent
                            ? { ...s, assigned_coach_id: assignedCoach }
                            : s
                    ));
                }
            }

            // Get current user for created_by field
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error('Usuario no autenticado');

            const shortCode = nanoid(8);

            const { error: insertError } = await (supabase
                .from('payment_links') as any)
                .insert({
                    id: shortCode,
                    student_id: selectedStudent,
                    pack_id: selectedPack,
                    gateway: selectedGateway,
                    status: 'pending',
                    created_by: user.id,
                    // @ts-ignore
                    metadata: {
                        coach_id: assignedCoach,
                        closer_id: selectedCloser,
                        setter_id: selectedSetter || null,
                    } as any,
                } as any);

            if (insertError) throw insertError;

            const link = `${CONFIG.APP.URL}/p/${shortCode}`;
            setGeneratedLink(link);
            setGeneratedLinkId(shortCode); // Guardar el ID para simular pago

            // Reset form
            setSelectedStudent('');
            setSelectedPack('');
            setSelectedGateway('');
            setSelectedCloser('');
            setSelectedSetter('');
            setAssignedCoach('');

        } catch (err: any) {
            console.error('Error generando link:', err);
            setError(err.message || 'Error al generar el link');
        } finally {
            setLoading(false);
        }
    };

    const handleCopyLink = () => {
        navigator.clipboard.writeText(generatedLink);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const handleSimulatePayment = async () => {
        if (!generatedLinkId) return;

        setSimulatingPayment(true);
        setError(null);
        setSuccess(null);

        try {
            const response = await fetch('/api/test/simulate-payment', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ linkId: generatedLinkId }),
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Error simulando pago');
            }

            setSuccess(`✅ ${data.message}`);
            setGeneratedLink('');
            setGeneratedLinkId('');

            // Recargar la página después de 2 segundos para ver las comisiones
            setTimeout(() => {
                window.location.reload();
            }, 2000);

        } catch (err: any) {
            console.error('Error simulando pago:', err);
            setError(err.message || 'Error al simular el pago');
        } finally {
            setSimulatingPayment(false);
        }
    };

    return (
        <Card className="w-full max-w-2xl">
            <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                    <Send className="w-5 h-5" />
                    <span>Generador de Links de Pago</span>
                </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
                {/* Student */}
                <div className="space-y-2">
                    <Label htmlFor="student">Estudiante *</Label>
                    <div className="flex gap-2">
                        <select
                            id="student"
                            value={selectedStudent}
                            onChange={(e) => setSelectedStudent(e.target.value)}
                            className="w-full h-10 px-3 rounded-lg border border-gray-300 bg-white text-sm"
                            disabled={loading}
                        >
                            <option value="">Seleccionar estudiante...</option>
                            {students.map(student => (
                                <option key={student.id} value={student.id}>
                                    {student.email} - {student.full_name}
                                </option>
                            ))}
                        </select>
                        <StudentForm
                            onSuccess={(newStudent) => {
                                if (newStudent) {
                                    setStudents(prev => [...prev, newStudent].sort((a, b) => a.email.localeCompare(b.email)));
                                    setSelectedStudent(newStudent.id);
                                }
                            }}
                            trigger={
                                <Button id="open-new-student-modal" size="icon" variant="outline" type="button" title="Nuevo Alumno">
                                    <UserPlus className="w-4 h-4" />
                                </Button>
                            }
                        />
                    </div>
                </div>

                {/* Pack */}
                <div className="space-y-2">
                    <Label htmlFor="pack">Pack *</Label>
                    <select
                        id="pack"
                        value={selectedPack}
                        onChange={(e) => setSelectedPack(e.target.value)}
                        className="w-full h-10 px-3 rounded-lg border border-gray-300 bg-white text-sm"
                        disabled={loading}
                    >
                        <option value="">Seleccionar pack...</option>
                        {packs.map(pack => (
                            <option key={pack.id} value={pack.id}>
                                {pack.name} - {pack.price.toFixed(2)}€
                            </option>
                        ))}
                    </select>
                </div>

                {/* Gateway */}
                <div className="space-y-2">
                    <Label htmlFor="gateway">Pasarela de Pago *</Label>
                    <select
                        id="gateway"
                        value={selectedGateway}
                        onChange={(e) => setSelectedGateway(e.target.value)}
                        className="w-full h-10 px-3 rounded-lg border border-gray-300 bg-white text-sm"
                        disabled={loading || !selectedPack}
                    >
                        <option value="">Seleccionar pasarela...</option>
                        {availableGateways.map(gateway => (
                            <option key={gateway} value={gateway}>
                                {gateway.charAt(0).toUpperCase() + gateway.slice(1)}
                            </option>
                        ))}
                    </select>
                    {selectedPack && availableGateways.length === 0 && (
                        <p className="text-xs text-orange-600">
                            Este pack no tiene pasarelas configuradas
                        </p>
                    )}
                </div>

                {/* Coach Selection */}
                <div className="space-y-2">
                    <Label htmlFor="coach">Coach *</Label>
                    <select
                        id="coach"
                        value={assignedCoach}
                        onChange={(e) => setAssignedCoach(e.target.value)}
                        className="w-full h-10 px-3 rounded-lg border border-gray-300 bg-white text-sm"
                        disabled={loading || (!!selectedStudent && !!students.find(s => s.id === selectedStudent)?.assigned_coach_id)}
                    >
                        <option value="">Seleccionar coach...</option>
                        {coaches.map(coach => (
                            <option key={coach.id} value={coach.id}>
                                {coach.full_name} ({coach.email})
                            </option>
                        ))}
                    </select>
                    {selectedStudent && students.find(s => s.id === selectedStudent)?.assigned_coach_id && (
                        <p className="text-xs text-gray-500">
                            El coach está pre-asignado al estudiante y no se puede cambiar aquí.
                        </p>
                    )}
                </div>

                {/* Closer */}
                <div className="space-y-2">
                    <Label htmlFor="closer">Closer *</Label>
                    <select
                        id="closer"
                        value={selectedCloser}
                        onChange={(e) => setSelectedCloser(e.target.value)}
                        className="w-full h-10 px-3 rounded-lg border border-gray-300 bg-white text-sm"
                        disabled={loading}
                    >
                        <option value="">Seleccionar closer...</option>
                        {closers.map(closer => (
                            <option key={closer.id} value={closer.id}>
                                {closer.full_name} ({closer.email})
                            </option>
                        ))}
                    </select>
                </div>

                {/* Setter (opcional) */}
                <div className="space-y-2">
                    <Label htmlFor="setter">Setter (Opcional)</Label>
                    <select
                        id="setter"
                        value={selectedSetter}
                        onChange={(e) => setSelectedSetter(e.target.value)}
                        className="w-full h-10 px-3 rounded-lg border border-gray-300 bg-white text-sm"
                        disabled={loading}
                    >
                        <option value="">Sin setter</option>
                        {setters.map(setter => (
                            <option key={setter.id} value={setter.id}>
                                {setter.full_name} ({setter.email})
                            </option>
                        ))}
                    </select>
                </div>

                {error && (
                    <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
                        {error}
                    </div>
                )}

                {/* Botón generar */}
                <Button
                    onClick={handleGenerateLink}
                    disabled={loading}
                    className="w-full"
                >
                    {loading ? 'Generando...' : 'Generar Link de Pago'}
                </Button>

                {/* Success message */}
                {success && (
                    <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg text-sm">
                        {success}
                    </div>
                )}

                {/* Link generado */}
                {generatedLink && (
                    <div className="mt-6 p-4 bg-green-50 border border-green-200 rounded-lg space-y-3">
                        <div className="flex items-center space-x-2 text-green-700">
                            <CheckCircle2 className="w-5 h-5" />
                            <span className="font-medium">Link generado exitosamente</span>
                        </div>
                        <div className="flex items-center space-x-2">
                            <Input
                                value={generatedLink}
                                readOnly
                                className="flex-1 bg-white"
                            />
                            <Button
                                onClick={handleCopyLink}
                                variant="secondary"
                                size="sm"
                            >
                                {copied ? (
                                    <>
                                        <CheckCircle2 className="w-4 h-4 mr-2" />
                                        Copiado
                                    </>
                                ) : (
                                    <>
                                        <Copy className="w-4 h-4 mr-2" />
                                        Copiar
                                    </>
                                )}
                            </Button>
                        </div>

                        {/* Botón de simulación */}
                        <div className="pt-3 border-t border-green-300">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-sm font-medium text-green-900">🧪 Modo de Prueba</p>
                                    <p className="text-xs text-green-700">Simula un pago exitoso sin API keys</p>
                                </div>
                                <Button
                                    onClick={handleSimulatePayment}
                                    disabled={simulatingPayment}
                                    size="sm"
                                    variant="default"
                                >
                                    {simulatingPayment ? 'Procesando...' : '🎯 Simular Pago'}
                                </Button>
                            </div>
                        </div>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
