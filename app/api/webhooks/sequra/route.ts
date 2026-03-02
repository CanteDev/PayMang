import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createHash } from 'crypto';
import { sequraRequest } from '@/lib/sequra/client';
import { syncPaymentToInstallments } from '@/lib/payments-updater';

/**
 * SeQura IPN Handler (Instant Payment Notification)
 * 
 * SeQura enviará un POST aquí cuando apruebe un pedido.
 * El merchant DEBE:
 *   1. Verificar el token de seguridad
 *   2. Confirmar el pedido con PUT /orders/{order_ref} { state: "confirmed" }
 *   3. Crear la venta y activar acceso del alumno
 *   4. Responder 200 OK a SeQura
 * 
 * IPs de SeQura (sandbox y producción):
 *   - 34.253.159.179
 *   - 34.252.147.155
 *   - 52.211.243.177
 * 
 * Documentación: https://docs.sequrapi.com/checkout/order_confirm_order_IPN.html
 */

function getSupabaseAdmin() {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    if (!serviceRoleKey) throw new Error('SUPABASE_SERVICE_ROLE_KEY missing');
    return createClient(supabaseUrl, serviceRoleKey);
}

function verifyIpnToken(linkId: string, token: string): boolean {
    const salt = process.env.SEQURA_IPN_SECRET || 'default-salt-change-in-production';
    const expected = createHash('sha1').update(`${linkId}:${salt}`).digest('hex');
    return expected === token;
}

export async function POST(request: NextRequest) {
    // SeQura envía application/x-www-form-urlencoded
    let formBody: URLSearchParams;
    try {
        const rawText = await request.text();
        formBody = new URLSearchParams(rawText);
    } catch {
        return NextResponse.json({ error: 'Invalid body' }, { status: 400 });
    }

    // Campos que SeQura incluye en el IPN:
    const orderRef = formBody.get('order_ref');         // UUID de SeQura
    const linkId = formBody.get('order_ref_1');         // Nuestro link_id (enviado en merchant_reference.order_ref_1)
    const approvedSince = formBody.get('approved_since'); // Segundos desde la aprobación (útil para debug)
    const productCode = formBody.get('product_code');   // Tipo de producto: i1, pp3, pp6, etc.

    // También llegará en notification_parameters si los incluimos:
    const token = formBody.get('token');                // Token SHA1 de seguridad

    console.log(`🔔 SeQura IPN recibido: order_ref=${orderRef}, link_id=${linkId}, product=${productCode}, approved_since=${approvedSince}s`);

    if (!orderRef || !linkId) {
        console.error('SeQura IPN: Faltan campos obligatorios (order_ref o order_ref_1)');
        // Devolver 200 para que SeQura no reintente indefinidamente
        return new Response('Missing required fields', { status: 200 });
    }

    // Verificar token de seguridad anti-spoofing
    if (token && !verifyIpnToken(linkId, token)) {
        console.error(`SeQura IPN: Token inválido para link_id=${linkId}`);
        return new Response('Invalid token', { status: 200 }); // 200 para no hacer que SeQura reintente
    }

    const supabase = getSupabaseAdmin();

    try {
        // 1. Buscar el payment_link
        const { data: link, error: linkError } = await supabase
            .from('payment_links')
            .select('*, pack:packs(*), offer:pack_offers(*)')
            .eq('id', linkId)
            .single();

        if (linkError || !link) {
            console.error(`SeQura IPN: Link no encontrado: ${linkId}`);
            return new Response('Link not found', { status: 200 });
        }

        // Extraer datos del link
        const { coach_id, closer_id, setter_id, target_sale_id } = link.metadata || {};
        const packPrice = link.offer?.price || link.pack?.price || 0;
        const productName = link.offer?.name
            ? `${link.pack?.name} - ${link.offer.name}`
            : link.pack?.name;

        // 2. PASO OBLIGATORIO: Confirmar el pedido con SeQura
        //    PUT /orders/{order_ref} con state="confirmed" y el payload completo del pedido
        //    SeQura verifica que el carrito no ha cambiado y aprueba definitivamente
        try {
            await sequraRequest(`orders/${orderRef}`, 'PUT', {
                order: {
                    state: 'confirmed',
                    merchant: {
                        id: link.pack?.merchant_id || process.env.SEQURA_MERCHANT_ID,
                    },
                    merchant_reference: {
                        order_ref_1: linkId,
                    },
                    cart: {
                        currency: 'EUR',
                        items: [
                            {
                                reference: link.offer?.external_id || link.offer?.id || link.pack?.id,
                                name: productName,
                                price_with_tax: Math.round(packPrice * 100),
                                quantity: 1,
                                total_with_tax: Math.round(packPrice * 100),
                                type: 'service',
                            }
                        ],
                        order_total_with_tax: Math.round(packPrice * 100),
                    },
                }
            });
            console.log(`✅ SeQura: Pedido ${orderRef} confirmado correctamente`);
        } catch (confirmError: any) {
            // Si SeQura responde 409, el carrito cambió. No completar la venta.
            console.error(`SeQura IPN: Error confirmando pedido ${orderRef}:`, confirmError.message);
            // Devolver 200 igualmente para que SeQura no reintente el IPN
            return new Response('Confirmation failed', { status: 200 });
        }

        // 3. Buscar o crear la venta
        // La venta pudo crearse en estado 'pending' en initiateSequraPayment
        let sale;

        const { data: existingSale } = await supabase
            .from('sales')
            .select('*')
            .eq('transaction_id', orderRef)
            .eq('gateway', 'sequra')
            .single();

        if (existingSale) {
            // Actualizar venta pending → paid
            const { data: updatedSale } = await supabase
                .from('sales')
                .update({
                    status: 'paid',
                    metadata: {
                        ...existingSale.metadata,
                        sequra_product_code: productCode,
                        ipn_received_at: new Date().toISOString(),
                    }
                })
                .eq('id', existingSale.id)
                .select()
                .single();
            sale = updatedSale;
            console.log(`📝 SeQura: Venta existente ${existingSale.id} actualizada a 'paid'`);
        } else {
            // Crear venta nueva (si no se creó en initiateSequraPayment)
            const { data: newSale, error: saleError } = await supabase
                .from('sales')
                .insert({
                    student_id: link.student_id,
                    pack_id: link.pack_id,
                    gateway: 'sequra',
                    total_amount: packPrice,
                    amount_collected: packPrice, // SeQura garantiza el pago completo
                    status: 'paid',
                    transaction_id: orderRef,
                    sequra_order_ref: orderRef,
                    coach_id,
                    closer_id,
                    setter_id,
                    metadata: {
                        ...link.metadata,
                        pack_offer_id: link.pack_offer_id,
                        link_id: linkId,
                        sequra_product_code: productCode,
                        ipn_received_at: new Date().toISOString(),
                    },
                } as any)
                .select()
                .single();

            if (saleError) {
                console.error('SeQura IPN: Error creando venta:', saleError);
                return new Response('Sale creation failed', { status: 200 });
            }
            sale = newSale;
            console.log(`✅ SeQura: Nueva venta creada ${sale.id}`);
        }

        // 4. Sincronizar cuotas con installments (igual que Stripe/Hotmart)
        try {
            await syncPaymentToInstallments(
                supabase,
                link.student_id,
                sale.id,
                packPrice,
                'sequra'
            );
        } catch (installmentsError) {
            console.error('SeQura IPN: Error sincronizando installments:', installmentsError);
            // No bloqueamos el flujo principal
        }

        // 5. Actualizar estado del link a 'paid'
        await supabase
            .from('payment_links')
            .update({ status: 'paid' })
            .eq('id', linkId);

        console.log(`✅ SeQura IPN procesado: venta ${sale.id}, link ${linkId} → paid`);

        // 6. OBLIGATORIO: Responder 200 OK a SeQura
        //    SeQura redirigirá al alumno a return_url después de recibir este 200
        return new Response('OK', { status: 200 });

    } catch (error: any) {
        console.error('SeQura IPN: Error inesperado:', error);
        // Devolver 200 para evitar reintentos infinitos de SeQura
        // (retryable errors should return 5xx, but we prefer to handle internally)
        return new Response('Error procesado internamente', { status: 200 });
    }
}
