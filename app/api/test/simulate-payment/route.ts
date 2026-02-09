import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { CONFIG } from '@/config/app.config';

/**
 * 🧪 MODO DE PRUEBA
 * Simula un pago exitoso sin necesitar API keys de pasarelas
 * Solo para desarrollo/testing
 */
export async function POST(request: NextRequest) {
    try {
        const { linkId } = await request.json();

        if (!linkId) {
            return NextResponse.json(
                { error: 'linkId es requerido' },
                { status: 400 }
            );
        }

        const supabase = await createClient();

        // 1. Buscar el payment_link
        const { data: link, error: linkError } = await supabase
            .from('payment_links')
            .select(`
        *,
        student:students(*),
        pack:packs(*)
      `)
            .eq('id', linkId)
            .single();

        if (linkError || !link) {
            return NextResponse.json(
                { error: 'Link no encontrado' },
                { status: 404 }
            );
        }

        if (link.status === 'paid') {
            return NextResponse.json(
                { error: 'Este link ya fue usado' },
                { status: 400 }
            );
        }

        const { coach_id, closer_id, setter_id } = link.metadata || {};
        const totalAmount = link.pack.price;

        // 2. Crear venta simulada
        const { data: sale, error: saleError } = await supabase
            .from('sales')
            .insert({
                student_id: link.student_id,
                pack_id: link.pack_id,
                amount: totalAmount,
                gateway: link.gateway,
                transaction_id: `TEST_${Date.now()}_${linkId}`,
                status: 'paid',
                metadata: {
                    test_mode: true,
                    simulated_at: new Date().toISOString(),
                },
            })
            .select()
            .single();

        if (saleError) {
            console.error('Error creando venta simulada:', saleError);
            return NextResponse.json(
                { error: 'Error creando venta' },
                { status: 500 }
            );
        }

        // 3. Actualizar link a paid
        await supabase
            .from('payment_links')
            .update({ status: 'paid' })
            .eq('id', linkId);

        // 4. Crear comisiones automáticamente
        const commissions: any[] = [];

        // Coach: 10%
        if (coach_id) {
            commissions.push({
                sale_id: sale.id,
                agent_id: coach_id,
                agent_role: 'coach',
                amount: Math.round(totalAmount * CONFIG.COMMISSION_RATES.COACH * 100) / 100,
                status: 'pending',
                milestone: 1,
            });
        }

        // Closer: 8%
        if (closer_id) {
            commissions.push({
                sale_id: sale.id,
                agent_id: closer_id,
                agent_role: 'closer',
                amount: Math.round(totalAmount * CONFIG.COMMISSION_RATES.CLOSER * 100) / 100,
                status: 'pending',
                milestone: 1,
            });
        }

        // Setter: 1% (opcional)
        if (setter_id) {
            commissions.push({
                sale_id: sale.id,
                agent_id: setter_id,
                agent_role: 'setter',
                amount: Math.round(totalAmount * CONFIG.COMMISSION_RATES.SETTER * 100) / 100,
                status: 'pending',
                milestone: 1,
            });
        }

        const { error: commissionError } = await supabase
            .from('commissions')
            .insert(commissions);

        if (commissionError) {
            console.error('Error creando comisiones:', commissionError);
            return NextResponse.json(
                { error: 'Error creando comisiones' },
                { status: 500 }
            );
        }

        console.log(`🧪 Pago simulado procesado: ${sale.id}`);
        console.log(`✅ ${commissions.length} comisiones creadas`);

        return NextResponse.json({
            success: true,
            sale_id: sale.id,
            amount: totalAmount,
            commissions_created: commissions.length,
            message: '¡Pago simulado exitosamente! Revisa la tabla de comisiones.',
        });

    } catch (error) {
        console.error('Error en simulación de pago:', error);
        return NextResponse.json(
            { error: 'Error interno del servidor' },
            { status: 500 }
        );
    }
}
