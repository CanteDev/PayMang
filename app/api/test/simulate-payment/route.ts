import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

/**
 * 🧪 MODO DE PRUEBA
 * Simula un pago exitoso sin necesitar API keys de pasarelas.
 * - Si la pasarela es Hotmart → redirige internamente al webhook de Hotmart (flujo real con comisiones via trigger)
 * - Otros gateways (manual, etc.) → flujo directo simplificado
 * Solo para desarrollo/testing.
 */
export async function POST(request: NextRequest) {
    try {
        const { linkId } = await request.json();

        if (!linkId) {
            return NextResponse.json({ error: 'linkId es requerido' }, { status: 400 });
        }

        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
        const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

        if (!serviceRoleKey) {
            return NextResponse.json({ error: 'Service Role Key no configurada' }, { status: 500 });
        }

        const supabase = createClient(supabaseUrl, serviceRoleKey);

        // Buscar el link con toda la info relacionada
        const { data: link, error: linkError } = await supabase
            .from('payment_links')
            .select('*, student:students(*), pack:packs(*), offer:pack_offers(*)')
            .eq('id', linkId)
            .single();

        if (linkError || !link) {
            return NextResponse.json({ error: 'Link no encontrado' }, { status: 404 });
        }

        if (link.status === 'paid') {
            return NextResponse.json({ error: 'Este link ya fue usado' }, { status: 400 });
        }

        const totalAmount = link.offer ? link.offer.price : link.pack.price;

        // ─── HOTMART: simular via webhook real ───────────────────────────────────
        if (link.gateway === 'hotmart') {
            const hotmartPayload = {
                event: 'PURCHASE_APPROVED',
                version: '2.0.0',
                creation_date: new Date().toISOString(),
                data: {
                    product: {
                        id: 10000,
                        name: link.pack.name,
                        ucode: 'simulated-product'
                    },
                    purchase: {
                        approved_date: new Date().toISOString(),
                        price: {
                            value: totalAmount,
                            currency_value: 'EUR'
                        },
                        full_price: {
                            value: totalAmount,
                            currency_value: 'EUR'
                        },
                        transaction: `SIM${Date.now()}`,
                        status: 'APPROVED',
                        is_subscription: false,
                        // linkId viaja en src/sck para que el webhook lo identifique
                        src: linkId,
                        sck: linkId,
                        payment: {
                            installments_number: 1,
                            type: 'CREDIT_CARD'
                        },
                        purchase_id: `sim_purchase_${Date.now()}`
                    },
                    buyer: {
                        email: link.student?.email || 'test@simulated.com',
                        name: link.student?.full_name || 'Test Buyer'
                    },
                    producer: { name: 'Simulated Producer' }
                }
            };

            // Leer webhook secret desde app_settings (igual que el webhook real)
            const { getGatewayConfig } = await import('@/lib/settings-helper');
            const hotmartConfig = await getGatewayConfig('hotmart');
            const webhookToken = hotmartConfig.webhook_secret || hotmartConfig.WEBHOOK_SECRET
                || process.env.HOTMART_WEBHOOK_SECRET || 'sim_token';

            // Llamar al webhook de Hotmart internamente (flujo real: trigger genera comisiones)
            const origin = request.nextUrl.origin;
            const webhookRes = await fetch(`${origin}/api/webhooks/hotmart`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-hotmart-hottok': webhookToken
                },
                body: JSON.stringify(hotmartPayload)
            });

            if (!webhookRes.ok) {
                const errData = await webhookRes.json().catch(() => ({}));
                throw new Error(`Webhook Hotmart respondió ${webhookRes.status}: ${JSON.stringify(errData)}`);
            }

            console.log(`🧪 [SIM-HOTMART] Pago simulado via webhook para link ${linkId}`);
            return NextResponse.json({
                success: true,
                amount: totalAmount,
                message: '¡Pago Hotmart simulado exitosamente! Revisa la tabla de comisiones.'
            });
        }

        // ─── OTROS GATEWAYS (manual, etc.) ───────────────────────────────────────
        const { coach_id, closer_id, setter_id, target_sale_id } = link.metadata || {};

        let existingSale = null;
        if (target_sale_id) {
            const { data } = await supabase.from('sales').select('*').eq('id', target_sale_id).single();
            existingSale = data;
        } else {
            const { data } = await supabase.from('sales').select('*')
                .eq('student_id', link.student_id).eq('pack_id', link.pack_id)
                .eq('status', 'pending').limit(1).single();
            existingSale = data;
        }

        let sale, saleError;

        if (existingSale) {
            const newTxId = existingSale.transaction_id
                ? `${existingSale.transaction_id},SIMULATED_${Date.now()}`
                : `SIMULATED_${Date.now()}`;

            const { data: updatedSale, error } = await supabase
                .from('sales')
                .update({
                    gateway: link.gateway,
                    transaction_id: newTxId,
                    status: 'paid',
                    coach_id: coach_id || existingSale.coach_id,
                    closer_id: closer_id || existingSale.closer_id,
                    setter_id: setter_id || existingSale.setter_id,
                    metadata: { ...existingSale.metadata, test_mode: true, simulated_at: new Date().toISOString() }
                } as any)
                .eq('id', existingSale.id).select().single();
            sale = updatedSale;
            saleError = error;
        } else {
            const { data: newSale, error } = await supabase.from('sales')
                .insert({
                    student_id: link.student_id,
                    pack_id: link.pack_id,
                    total_amount: totalAmount,
                    amount_collected: 0,
                    gateway: link.gateway,
                    transaction_id: `SIMULATED_${Date.now()}_${linkId}`,
                    status: 'paid',
                    coach_id, closer_id, setter_id,
                    metadata: { test_mode: true, simulated_at: new Date().toISOString() }
                } as any).select().single();
            sale = newSale;
            saleError = error;
        }

        if (saleError || !sale) {
            return NextResponse.json({ error: `Error procesando venta: ${saleError?.message}` }, { status: 500 });
        }

        // syncPaymentToInstallments → dispara el trigger que crea comisiones
        const { syncPaymentToInstallments } = await import('@/lib/payments-updater');
        const updatedPayment = await syncPaymentToInstallments(supabase, link.student_id, sale.id, totalAmount, link.gateway || 'manual');

        // Aplicar external_id a todos los registros para que se agrupen en la UI (estándar Stripe)
        if (updatedPayment?.allIds && updatedPayment.allIds.length > 0) {
            await supabase
                .from('payments')
                .update({
                    external_id: sale.transaction_id,
                    metadata: { simulated: true }
                })
                .in('id', updatedPayment.allIds);
        }

        await supabase.from('payment_links').update({ status: 'paid' }).eq('id', linkId);


        console.log(`🧪 [SIM] Pago simulado procesado para venta ${sale.id}`);
        return NextResponse.json({
            success: true,
            sale_id: sale.id,
            amount: totalAmount,
            message: '¡Pago simulado exitosamente! Revisa la tabla de comisiones.'
        });

    } catch (error: any) {
        console.error('Error en simulación de pago:', error);
        return NextResponse.json({ error: error.message || 'Error interno del servidor' }, { status: 500 });
    }
}
