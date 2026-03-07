'use server';

import { createClient } from '@/lib/supabase/server';
import { CONFIG } from '@/config/app.config';
import { startSolicitation, getIdentificationForm } from '@/lib/sequra/client';
import { PaymentLinkWithRelations } from '@/types/database';
import { getAppConfig } from '@/lib/config/server-config';
import { createHash } from 'crypto';

/**
 * Genera un token SHA1 para asegurar la llamada IPN de SeQura.
 * El mismo token se incluye en notification_parameters al crear el pedido
 * y se verifica cuando llega el IPN.
 */
function generateIpnToken(linkId: string): string {
    const salt = process.env.SEQURA_IPN_SECRET || 'default-salt-change-in-production';
    return createHash('sha1').update(`${linkId}:${salt}`).digest('hex');
}

export async function initiateSequraPayment(linkId: string) {
    const supabase: any = await createClient();

    // 1. Fetch Link Details
    const { data: link, error: linkError } = await supabase
        .from('payment_links')
        .select(`
            *,
            student:students(*),
            pack:packs(*),
            offer:pack_offers(*)
        `)
        .eq('id', linkId)
        .single();

    if (linkError || !link) {
        return { success: false, error: 'Link no válido o expirado' };
    }

    const paymentLink = link as PaymentLinkWithRelations;

    if (paymentLink.status === 'paid' || paymentLink.status === 'deleted') {
        return { success: false, error: 'Link expirado o ya pagado' };
    }

    if (!paymentLink.student || !paymentLink.pack) {
        return { success: false, error: 'Datos del link incompletos' };
    }

    // 2. Determinar precio y nombre del producto
    const activePrice = paymentLink.offer?.price ?? paymentLink.pack.price;
    const activeName = paymentLink.offer?.name
        ? `${paymentLink.pack.name} - ${paymentLink.offer.name}`
        : paymentLink.pack.name;
    const activeReference = paymentLink.offer?.external_id || paymentLink.offer?.id || paymentLink.pack.id;

    // 3. Separar nombre y apellidos del alumno
    const fullName = paymentLink.student.full_name || '';
    const nameParts = fullName.trim().split(' ');
    const givenNames = nameParts[0] || '';
    const surnames = nameParts.slice(1).join(' ') || givenNames; // fallback al nombre si no hay apellidos

    // 4. Obtener configuración de SeQura
    const sequraConfig = await getAppConfig('sequra_config');
    const merchantId = sequraConfig?.MERCHANT_ID || sequraConfig?.merchantId || CONFIG.GATEWAYS.SEQURA.MERCHANT_ID;

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || CONFIG.APP.URL;

    // 5. Token de seguridad para el IPN (se verifica cuando SeQura llama a notify_url)
    const ipnToken = generateIpnToken(linkId);

    // 6. Construir payload del pedido según documentación oficial SeQura
    // Paso 1: "Start Solicitation" → state debe ser 'solicited'
    // notify_url: SeQura hará POST aquí cuando apruebe el pedido (IPN)
    // return_url: SeQura redirigirá al alumno aquí tras la identificación
    // order_ref_1: Nuestra referencia (linkId) que llegará en el IPN para identificar el pedido
    const orderData = {
        order: {
            state: 'solicited',
            merchant: {
                id: merchantId,
                notify_url: `${appUrl}/api/webhooks/sequra`,
                return_url: `${appUrl}/p/sequra-confirmed?link=${linkId}`,
                notification_parameters: {
                    link_id: linkId,
                    token: ipnToken,
                },
                // NOTE: store_ref & operator_ref required by this merchant's contract
                store_ref: merchantId,           // Store identifier (merchantId for single-store)
                operator_ref: linkId,            // Unique reference per order
            },
            merchant_reference: {
                order_ref_1: linkId,
            },
            cart: {
                currency: 'EUR',
                gift: false,
                items: [
                    {
                        reference: activeReference,
                        name: activeName,
                        price_with_tax: Math.round(activePrice * 100),
                        quantity: 1,
                        total_with_tax: Math.round(activePrice * 100),
                        type: 'service',
                        downloadable: false,
                        // Services contract: ISO8601 period format required (not integer)
                        ends_in: 'P365D', // 1 year service duration in ISO 8601 period format
                        service_start_date: new Date().toISOString().split('T')[0],
                    }
                ],
                order_total_with_tax: Math.round(activePrice * 100),
            },
            customer: {
                email: paymentLink.student.email,
                given_names: givenNames,
                surnames: surnames,
                logged_in: false,
                language_code: 'es-ES', // formato iso correcto según docs
                ip_number: '0.0.0.0',   // no disponible server-side
                user_agent: 'Mozilla/5.0 PayMang-checkout/2.0',
            },
            // Obligatorio aunque sea servicio digital (puede ir vacío según ejemplo de docs)
            delivery_address: {
                given_names: givenNames,
                surnames: surnames,
                company: '',
                address_line_1: 'Servicio Digital',
                address_line_2: '',
                postal_code: '00000',
                city: 'Online',
                country_code: 'ES',
            },
            invoice_address: {
                given_names: givenNames,
                surnames: surnames,
                company: '',
                address_line_1: '',
                address_line_2: '',
                postal_code: '',
                city: '',
                country_code: 'ES',
            },
            delivery_method: {
                name: 'Servicio Digital',
                days: 'Inmediato', // string según el ejemplo oficial de la documentación
                provider: 'Digital',
                home_delivery: false,
            },
            gui: {
                layout: 'responsive',
            },
            platform: {
                name: CONFIG.APP.NAME,
                version: '2.0.0',
                plugin_version: '2.0.0',
                uname: 'Linux PayMang/2.0',
                db_name: 'PostgreSQL',
                db_version: '15',
            },
        }
    };

    try {
        // 7. Llamar a SeQura API: POST /orders → devuelve UUID del pedido en Location header
        const orderRef = await startSolicitation(orderData);

        if (!orderRef) {
            return { success: false, error: 'SeQura no devolvió referencia de pedido' };
        }

        // 8. Crear la venta en BD DESPUÉS de recibir orderRef (evitar registros zombie)
        // Status 'pending' hasta que SeQura confirme via IPN
        const { data: sale, error: saleError } = await supabase
            .from('sales')
            .insert({
                student_id: paymentLink.student.id,
                pack_id: paymentLink.pack.id,
                gateway: 'sequra',
                total_amount: activePrice,
                amount_collected: 0,
                status: 'pending',
                transaction_id: orderRef, // UUID real de SeQura
                sequra_order_ref: orderRef,
                metadata: {
                    ...paymentLink.metadata,
                    pack_offer_id: paymentLink.pack_offer_id,
                    link_id: linkId,
                    product_code: null, // Se completará cuando llegue el IPN
                },
                sequra_payment_status: {
                    initial_70: false,
                    second_15: false,
                    final_15: false,
                }
            } as any)
            .select()
            .single();

        if (saleError || !sale) {
            console.error('Error creating SeQura sale after solicitation:', saleError);
            // No bloqueamos el flujo: el IPN creará la venta si falla aquí,
            // pero es mejor tener el registro pending desde el inicio.
        }

        // 9. Obtener formulario de identificación para mostrarlo al alumno
        // GET /orders/{uuid}/form_v2?product=i1 (i1 = invoicing, pp1 = pago aplazado, etc.)
        // Get identification form: product code determines the financing type shown to the customer
        // 'pp6' = Paga Fraccionado (the available product for this merchant in sandbox)
        // The product code comes from the merchant's contract, not from the pack offer external_id
        // (external_id in pack_offers is the campaign/product ID in SeQura's catalog, not the financing type)
        const sequraProduct = (paymentLink.offer as any)?.sequra_product || 'pp6';
        const formHtml = await getIdentificationForm(orderRef, sequraProduct);

        return {
            success: true,
            form: formHtml,
            orderRef,
            saleId: sale?.id || null,
        };

    } catch (apiError: any) {
        console.error('SeQura API Error in initiateSequraPayment:', apiError);
        return { success: false, error: `Error comunicando con SeQura: ${apiError.message}` };
    }
}

/**
 * Verificar token IPN (usado en el handler del webhook)
 * Exportado para reutilizar en /api/webhooks/sequra/route.ts
 */
export async function verifySequraIpnToken(linkId: string, token: string): Promise<boolean> {
    const expected = generateIpnToken(linkId);
    return expected === token;
}
