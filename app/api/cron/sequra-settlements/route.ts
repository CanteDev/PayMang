import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getAppConfig } from '@/lib/config/server-config';
import { syncPaymentToInstallments } from '@/lib/payments-updater';

/**
 * Cron job para procesar settlements de seQura via Disbursement API oficial.
 * Consulta los desembolsos disponibles, procesa los settlements y actualiza
 * cuotas + comisiones usando la misma lógica unificada que Stripe/Hotmart.
 *
 * Se ejecuta diariamente a las 06:00 AM
 * Configurar en vercel.json: { "path": "/api/cron/sequra-settlements", "schedule": "0 6 * * *" }
 */
export async function GET(request: NextRequest) {
    // Verificar autorización (Vercel Cron Secret)
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;

    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log('🕐 Iniciando cron seQura settlements (Disbursement API)...');

    try {
        const supabase = await createClient();

        // --- Obtener configuración de SeQura ---
        const config = await getAppConfig('sequra_config');
        const merchantId = config?.MERCHANT_ID || config?.merchant_id;
        const apiKey = config?.API_KEY || config?.api_key;
        const environment = config?.ENVIRONMENT || config?.environment || 'sandbox';
        const apiUrl = environment === 'production'
            ? 'https://live.sequrapi.com'
            : 'https://sandbox.sequrapi.com';

        if (!merchantId || !apiKey) {
            console.error('Configuración de seQura incompleta');
            return NextResponse.json({ error: 'Configuración de seQura incompleta' }, { status: 500 });
        }

        const auth = Buffer.from(`${merchantId}:${apiKey}`).toString('base64');
        const headers = {
            'Authorization': `Basic ${auth}`,
            'Accept': 'application/json',
        };

        // --- 1. Obtener lista de desembolsos disponibles ---
        const disbResponse = await fetch(`${apiUrl}/merchants/${merchantId}/disbursements`, { headers });

        if (!disbResponse.ok) {
            const errText = await disbResponse.text().catch(() => disbResponse.statusText);
            console.error(`Error llamando a Disbursements API SeQura: ${disbResponse.status} - ${errText}`);
            return NextResponse.json({ error: `SeQura API error: ${disbResponse.status}` }, { status: 502 });
        }

        const disbList: any[] = await disbResponse.json();

        if (!disbList || disbList.length === 0) {
            console.log('ℹ️ No hay desembolsos disponibles en SeQura');
            return NextResponse.json({ success: true, message: 'No disbursements available', processed: 0 });
        }

        // --- 2. Obtener el último disbursement procesado de la BD ---
        const { data: setting } = await supabase
            .from('app_settings')
            .select('value')
            .eq('key', 'sequra_last_disbursement')
            .maybeSingle();

        const lastProcessedRef: string | null = (setting as any)?.value?.last_reference || null;

        let processedCount = 0;
        let errorCount = 0;
        let lastRefProcessed: string | null = null;

        // --- 3. Iterar desembolsos ---
        for (const entry of disbList) {
            const disbursement = entry?.disbursement || entry;
            const disbRef = disbursement?.reference;
            const disbPath = disbursement?.path;

            if (!disbRef || !disbPath) continue;

            // Saltar si ya procesamos este disbursement
            if (disbRef === lastProcessedRef) {
                console.log(`⏭ Disbursement ${disbRef} ya procesado. Parando aquí.`);
                break;
            }

            // --- 4. Obtener detalle del desembolso con sus settlements ---
            const detailResponse = await fetch(`${apiUrl}${disbPath}`, { headers });

            if (!detailResponse.ok) {
                console.error(`Error obteniendo detalle del disbursement ${disbRef}`);
                errorCount++;
                continue;
            }

            const detailData = await detailResponse.json();
            const settlements: any[] = detailData?.disbursement?.settlements || [];

            console.log(`📋 Procesando disbursement ${disbRef} con ${settlements.length} settlements`);

            for (const settlement of settlements) {
                const orderRef = settlement?.order_ref; // UUID de SeQura (nuestro transaction_id)
                const orderRef1 = settlement?.order_ref_1; // Este es nuestro link_id
                const amountCents = settlement?.amount_with_tax; // En céntimos

                // Si no hay orderRef (UUID) o importe es nulo/0, saltar
                if (!orderRef || !amountCents || amountCents <= 0) {
                    // Importe 0 = cancelada antes del desembolso, se ignora
                    continue;
                }

                const amountEuros = parseFloat((amountCents / 100).toFixed(2));

                try {
                    // Buscar la venta vinculada con el UUID de SeQura
                    const { data: sale } = await (supabase.from('sales') as any)
                        .select('id, student_id, amount_collected')
                        .eq('transaction_id', orderRef)
                        .eq('gateway', 'sequra')
                        .maybeSingle();

                    if (!sale) {
                        console.warn(`⚠️ Venta no encontrada para order_ref (UUID SeQura): ${orderRef} (link: ${orderRef1}). Posiblemente aún no procesada por IPN.`);
                        errorCount++;
                        continue;
                    }

                    // Llamar a syncPaymentToInstallments — igual que Stripe/Hotmart
                    // El trigger de BD generará las comisiones automáticamente
                    await syncPaymentToInstallments(
                        supabase,
                        sale.student_id,
                        sale.id,
                        amountEuros,
                        'sequra'
                    );

                    console.log(`✅ Settlement procesado: order=${orderRef1}, monto=€${amountEuros}`);
                    processedCount++;
                } catch (err: any) {
                    console.error(`❌ Error procesando settlement order=${orderRef1}:`, err.message);
                    errorCount++;
                }
            }

            lastRefProcessed = disbRef;
        }

        // --- 5. Guardar referencia del último disbursement procesado ---
        if (lastRefProcessed) {
            await (supabase.from('app_settings') as any).upsert({
                key: 'sequra_last_disbursement',
                category: 'system',
                value: { last_reference: lastRefProcessed, processed_at: new Date().toISOString() },
            }, { onConflict: 'key' });
        }

        console.log(`✅ Cron SeQura completado: ${processedCount} procesados, ${errorCount} errores`);

        return NextResponse.json({
            success: true,
            processed: processedCount,
            errors: errorCount,
            lastDisbursement: lastRefProcessed,
        });

    } catch (error: any) {
        console.error('❌ Error en cron seQura settlements:', error);
        return NextResponse.json({ error: 'Internal server error', detail: error.message }, { status: 500 });
    }
}
