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
    offers?: PackOffer[];
    commission_closer?: number;
    commission_coach?: number;
    commission_setter?: number;
}

interface PackOffer {
    id: string;
    pack_id: string;
    gateway: string;
    external_id: string | null;
    name: string;
    price: number;
    currency: string;
}

interface Profile {
    id: string;
    full_name: string;
    email: string;
    role: string;
    active_students?: number;
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
    const [selectedOffer, setSelectedOffer] = useState<string>('');
    const [selectedCloser, setSelectedCloser] = useState<string>('');
    const [selectedSetter, setSelectedSetter] = useState<string>('');

    // Commission Rates Override
    const [globalRates, setGlobalRates] = useState<{closer: number, coach: number, setter: number} | null>(null);
    const [saleCommCloser, setSaleCommCloser] = useState<string>('');
    const [saleCommCoach, setSaleCommCoach] = useState<string>('');
    const [saleCommSetter, setSaleCommSetter] = useState<string>('');

    const [generatedLink, setGeneratedLink] = useState<string>('');
    const [generatedLinkId, setGeneratedLinkId] = useState<string>('');
    const [copied, setCopied] = useState(false);
    const [loading, setLoading] = useState(false);
    const [simulatingPayment, setSimulatingPayment] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);

    const [availableGateways, setAvailableGateways] = useState<string[]>([]);
    const [availableOffers, setAvailableOffers] = useState<PackOffer[]>([]);
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

            // Cargar packs y sus ofertas
            const { data: packsData } = await supabase
                .from('packs')
                .select('*, pack_offers(*)')
                .eq('is_active', true)
                .order('name');
            if (packsData) {
                // Map pack_offers to offers for easier access
                const packsWithOffers = (packsData as any[]).map(p => ({
                    ...p,
                    offers: p.pack_offers?.filter((o: any) => o.is_active) || []
                }));
                setPacks(packsWithOffers);
            }

            // Cargar closers
            const { data: closersData } = await supabase
                .from('profiles')
                .select('*')
                .eq('role', 'closer')
                .eq('is_active', true)
                .order('full_name');
            if (closersData) setClosers(closersData);

            // Cargar globales
            const { data: ratesData } = await supabase
                .from('app_settings')
                .select('value')
                .eq('key', 'commission_rates')
                .single();
            if (ratesData && (ratesData as any).value) setGlobalRates((ratesData as any).value);

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
                // Autocompletar coach si está asignado, de lo contrario buscar el más libre
                if (student.assigned_coach_id) {
                    setAssignedCoach(student.assigned_coach_id);
                } else if (coaches.length > 0) {
                    const sortedCoaches = [...coaches].sort((a, b) => (a.active_students || 0) - (b.active_students || 0));
                    setAssignedCoach(sortedCoaches[0].id);
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
            setSelectedPack(''); // Reset pack when student changes
        } else if (!selectedStudent && prevSelectedStudentRef.current) {
            // Reset cuando se deselecciona
            setAssignedCoach('');
            setSelectedCloser('');
            setSelectedPack('');
            prevSelectedStudentRef.current = '';
        }
    }, [selectedStudent, students, coaches]);

    // Added: Load student's sales to filter packs
    const [studentSales, setStudentSales] = useState<any[]>([]);

    useEffect(() => {
        const fetchStudentSales = async () => {
            if (!selectedStudent) {
                setStudentSales([]);
                return;
            }

            const { data } = await supabase
                .from('sales')
                .select('id, pack_id, total_amount, amount_collected')
                .eq('student_id', selectedStudent);

            if (data) {
                setStudentSales(data);
            }
        };

        fetchStudentSales();
    }, [selectedStudent, supabase]);

    // Calculate which packs should be visible for the selected student
    const visiblePacks = packs.filter(pack => {
        if (!selectedStudent) return false; // Don't show packs until student is selected

        // Find if this student has this pack
        const sale = studentSales.find(s => s.pack_id === pack.id);

        // If they don't have the pack, they can't pay for it here
        if (!sale) return false;

        // If they have the pack, only show it if they still owe money
        const amountCollected = Number(sale.amount_collected || 0);
        const totalAmount = Number(sale.total_amount || 0);

        return amountCollected < totalAmount;
    });

    // Added: Load coaches when component mounts or as needed
    const loadCoaches = async () => {
        const { data: coachesData } = await supabase
            .from('profiles')
            .select('*')
            .eq('role', 'coach')
            .eq('is_active', true)
            .order('full_name');

        if (!coachesData) return;

        // Get all active students to count assignments
        const { data: activeStudents } = await supabase
            .from('students')
            .select('assigned_coach_id')
            .eq('status', 'active')
            .not('assigned_coach_id', 'is', null);

        // Count students per coach
        const studentCounts = (activeStudents || []).reduce((acc: any, std: any) => {
            if (std.assigned_coach_id) {
                acc[std.assigned_coach_id] = (acc[std.assigned_coach_id] || 0) + 1;
            }
            return acc;
        }, {});

        // Map coaches with counts
        const coachesWithCounts = (coachesData as any[]).map(coach => ({
            ...coach,
            active_students: studentCounts[coach.id] || 0
        }));

        setCoaches(coachesWithCounts);
    };

    useEffect(() => {
        loadCoaches();
    }, []);

    // Actualizar pasarelas y ofertas disponibles cuando cambia el pack
    useEffect(() => {
        if (selectedPack) {
            const pack = packs.find(p => p.id === selectedPack);
            if (pack) {
                // Set default commissions
                // pack.commission_* are stored as % integers (e.g. 8 = 8%)
                // globalRates are stored as decimals (e.g. 0.08 = 8%) → multiply *100 for display
                const cCloser = (pack.commission_closer && pack.commission_closer > 0)
                    ? pack.commission_closer
                    : (globalRates?.closer || 0) * 100;
                const cCoach = (pack.commission_coach && pack.commission_coach > 0)
                    ? pack.commission_coach
                    : (globalRates?.coach || 0) * 100;
                const cSetter = (pack.commission_setter && pack.commission_setter > 0)
                    ? pack.commission_setter
                    : (globalRates?.setter || 0) * 100;
                
                setSaleCommCloser(cCloser ? cCloser.toFixed(2) : '0');
                setSaleCommCoach(cCoach ? cCoach.toFixed(2) : '0');
                setSaleCommSetter(cSetter ? cSetter.toFixed(2) : '0');

                const gateways = new Set<string>();

                // Add gateways from offers, prioritize offers over gateway_ids
                if (pack.offers && pack.offers.length > 0) {
                    pack.offers.forEach(offer => gateways.add(offer.gateway));
                }

                // Add legacy gateway_ids if they exist
                if (pack.gateway_ids) {
                    if (pack.gateway_ids.stripe_link || pack.gateway_ids.stripe_prod_id || pack.gateway_ids.stripe) gateways.add('stripe');
                    if (pack.gateway_ids.hotmart_link || pack.gateway_ids.hotmart_prod_id || pack.gateway_ids.hotmart) gateways.add('hotmart');
                    if (pack.gateway_ids.sequra_link || pack.gateway_ids.sequra_merchant_id || pack.gateway_ids.sequra) gateways.add('sequra');
                }

                setAvailableGateways(Array.from(gateways));
                setSelectedGateway(''); // Reset gateway selection
                setSelectedOffer(''); // Reset offer selection
                setAvailableOffers([]);
            }
        } else {
            setAvailableGateways([]);
            setSelectedGateway('');
            setAvailableOffers([]);
            setSelectedOffer('');
            setSaleCommCloser('');
            setSaleCommCoach('');
            setSaleCommSetter('');
        }
    }, [selectedPack, packs, globalRates]);

    // Actualizar ofertas cuando cambia la pasarela
    useEffect(() => {
        if (selectedPack && selectedGateway) {
            const pack = packs.find(p => p.id === selectedPack);
            if (pack && pack.offers) {
                const gatewayOffers = pack.offers.filter(o => o.gateway === selectedGateway);
                setAvailableOffers(gatewayOffers);

                // Si la pasarela anterior tenía una oferta seleccionada, reset y dejar seleccionar
                setSelectedOffer('');

                // Set default to first offer if available to save clicks
                if (gatewayOffers.length === 1) {
                    setSelectedOffer(gatewayOffers[0].id);
                }
            }
        } else {
            setAvailableOffers([]);
            setSelectedOffer('');
        }
    }, [selectedGateway, packs, selectedPack]);

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

            // Find the specific sale we are aiming to collect debt for
            const targetSale = studentSales.find(s => s.pack_id === selectedPack);

            const { error: insertError } = await (supabase
                .from('payment_links') as any)
                .insert({
                    id: shortCode,
                    student_id: selectedStudent,
                    pack_id: selectedPack,
                    pack_offer_id: selectedOffer || null,
                    gateway: selectedGateway,
                    status: 'pending',
                    created_by: user.id,
                    // @ts-ignore
                    metadata: {
                        coach_id: assignedCoach,
                        closer_id: selectedCloser,
                        setter_id: selectedSetter || null,
                        target_sale_id: targetSale ? targetSale.id : undefined,
                        commission_closer: saleCommCloser ? parseFloat(saleCommCloser) / 100 : null,
                        commission_coach: saleCommCoach ? parseFloat(saleCommCoach) / 100 : null,
                        commission_setter: saleCommSetter ? parseFloat(saleCommSetter) / 100 : null
                    } as any,
                } as any);

            if (insertError) throw insertError;

            // Use window.location.origin if available to ensure the link matches the current Domain perfectly
            const baseUrl = typeof window !== 'undefined' ? window.location.origin : CONFIG.APP.URL;
            const link = `${baseUrl}/p/${shortCode}`;

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
                    <Label htmlFor="pack">Pack Contractado con Deuda *</Label>
                    <select
                        id="pack"
                        value={selectedPack}
                        onChange={(e) => setSelectedPack(e.target.value)}
                        className="w-full h-10 px-3 rounded-lg border border-gray-300 bg-white text-sm"
                        disabled={loading || !selectedStudent}
                    >
                        <option value="">Seleccionar pack...</option>
                        {[...visiblePacks].sort((a, b) => a.name.localeCompare(b.name)).map(pack => {
                            const sale = studentSales.find(s => s.pack_id === pack.id);
                            const pending = sale ? (Number(sale.total_amount) - Number(sale.amount_collected)).toFixed(2) : 0;
                            return (
                                <option key={pack.id} value={pack.id}>
                                    {pack.name} - Pendiente: {pending}€
                                </option>
                            );
                        })}
                    </select>
                    {selectedStudent && visiblePacks.length === 0 && (
                        <p className="text-xs text-orange-600">
                            Este estudiante no tiene packs con deuda pendiente.
                        </p>
                    )}
                </div>

                {/* Gateway */}
                <div className="space-y-2">
                    <Label htmlFor="gateway">Pasarela de Pago *</Label>
                    <select
                        id="gateway"
                        value={selectedGateway}
                        onChange={(e) => setSelectedGateway(e.target.value)}
                        className="w-full h-10 px-3 rounded-lg border border-gray-300 bg-white text-sm"
                        disabled={loading || !selectedPack || availableGateways.length === 0}
                    >
                        <option value="">Seleccionar pasarela...</option>
                        {[...availableGateways].sort().map(gateway => (
                            <option key={gateway} value={gateway}>
                                {gateway === 'hotmart' ? 'Hotmart' : gateway === 'stripe' ? 'Stripe' : gateway === 'sequra' ? 'SeQura' : gateway.charAt(0).toUpperCase() + gateway.slice(1)}
                            </option>
                        ))}
                    </select>
                    {selectedPack && availableGateways.length === 0 && (
                        <p className="text-xs text-orange-600">
                            Este pack no tiene pasarelas configuradas
                        </p>
                    )}
                </div>

                {/* Offer */}
                {availableOffers.length > 0 && (
                    <div className="space-y-2">
                        <Label htmlFor="offer">Oferta / Modalidad *</Label>
                        <select
                            id="offer"
                            value={selectedOffer}
                            onChange={(e) => setSelectedOffer(e.target.value)}
                            className="w-full h-10 px-3 rounded-lg border border-gray-300 bg-white text-sm"
                            disabled={loading || !selectedGateway}
                        >
                            <option value="">Seleccionar oferta...</option>
                            {availableOffers.map(offer => (
                                <option key={offer.id} value={offer.id}>
                                    {offer.name} - {offer.price} {offer.currency}
                                </option>
                            ))}
                        </select>
                    </div>
                )}

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
                                {coach.full_name} ({coach.email}) - {coach.active_students ?? 0} alumnos activos
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

                {/* Commission Override */}
                <div className="pt-2 border-t border-gray-200">
                    <p className="text-[10px] font-semibold text-gray-500 uppercase mb-2">Comisiones por Venta (%)</p>
                    <div className="grid grid-cols-3 gap-4">
                        <div className="space-y-1">
                            <Label className="text-[11px]">Closer (%)</Label>
                            <Input
                                type="number"
                                min="0" max="100" step="0.01"
                                value={saleCommCloser}
                                onChange={(e) => setSaleCommCloser(e.target.value)}
                                disabled={loading}
                                className="h-8 text-xs"
                            />
                        </div>
                        <div className="space-y-1">
                            <Label className="text-[11px]">Coach (%)</Label>
                            <Input
                                type="number"
                                min="0" max="100" step="0.01"
                                value={saleCommCoach}
                                onChange={(e) => setSaleCommCoach(e.target.value)}
                                disabled={loading}
                                className="h-8 text-xs"
                            />
                        </div>
                        <div className="space-y-1">
                            <Label className="text-[11px]">Setter (%)</Label>
                            <Input
                                type="number"
                                min="0" max="100" step="0.01"
                                value={saleCommSetter}
                                onChange={(e) => setSaleCommSetter(e.target.value)}
                                disabled={loading}
                                className="h-8 text-xs"
                            />
                        </div>
                    </div>
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
