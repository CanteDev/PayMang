import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { calculateCommission } from '@/lib/commissions/calculator';

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

        // Usar Service Role Key para bypass RLS durante testing
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
        const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

        if (!serviceRoleKey) {
            return NextResponse.json(
                { error: 'Service Role Key no configurada' },
                { status: 500 }
            );
        }

        const supabase = createClient(supabaseUrl, serviceRoleKey);

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

        // 2. Deduplication: Look for an existing pending sale
        const { data: existingSale } = await supabase
            .from('sales')
            .select('*')
            .eq('student_id', link.student_id)
            .eq('pack_id', link.pack_id)
            .eq('status', 'pending')
            .limit(1)
            .single();

        let sale;
        let saleError;

        const salePayload = {
            student_id: link.student_id,
            pack_id: link.pack_id,
            total_amount: totalAmount,
            amount_collected: totalAmount,
            gateway: link.gateway,
            transaction_id: `SIMULATED_${Date.now()}_${linkId}`,
            status: 'paid',
            metadata: {
                test_mode: true,
                simulated_at: new Date().toISOString(),
                coach_id,
                closer_id,
                setter_id
            },
        };

        if (existingSale) {
            console.log(`[SIM] Found pending sale ${existingSale.id}. Updating.`);
            const { data: updatedSale, error: updateError } = await supabase
                .from('sales')
                .update(salePayload as any)
                .eq('id', existingSale.id)
                .select()
                .single();
            sale = updatedSale;
            saleError = updateError;
        } else {
            console.log(`[SIM] No pending sale. Creating new.`);
            const { data: newSale, error: insertError } = await supabase
                .from('sales')
                .insert(salePayload as any)
                .select()
                .single();
            sale = newSale;
            saleError = insertError;
        }

        if (saleError || !sale) {
            console.error('Error creating/updating simulated sale:', saleError);
            return NextResponse.json(
                { error: `Error procesando venta: ${saleError?.message}` },
                { status: 500 }
            );
        }

        // 2.5 Sync installments (IMPORTANT: now required by logic)
        const { syncGatewayPaymentToInstallments } = await import('@/lib/payments-updater');
        await syncGatewayPaymentToInstallments(supabase, link.student_id, sale.id, totalAmount, link.gateway);

        // 3. Actualizar link a paid
        await supabase
            .from('payment_links')
            .update({ status: 'paid' })
            .eq('id', linkId);

        // 4. Crear comisiones automáticamente
        const commissions: any[] = [];

        // Coach
        if (coach_id) {
            commissions.push({
                sale_id: sale.id,
                agent_id: coach_id,
                role_at_sale: 'coach',
                amount: await calculateCommission(totalAmount, 'coach'),
                status: 'pending',
                milestone: 1,
            });
        }

        // Closer
        if (closer_id) {
            commissions.push({
                sale_id: sale.id,
                agent_id: closer_id,
                role_at_sale: 'closer',
                amount: await calculateCommission(totalAmount, 'closer'),
                status: 'pending',
                milestone: 1,
            });
        }

        // Setter
        if (setter_id) {
            commissions.push({
                sale_id: sale.id,
                agent_id: setter_id,
                role_at_sale: 'setter',
                amount: await calculateCommission(totalAmount, 'setter'),
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
                { error: `Error creando comisiones: ${commissionError.message}`, details: commissionError },
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
