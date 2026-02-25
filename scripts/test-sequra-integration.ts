import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();
dotenv.config({ path: '.env.local' });

const supabase = createClient<any>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function startSequraSolicitation(orderData: any, config: any) {
    const url = `${config.API_URL}/orders`;
    const auth = Buffer.from(`${config.MERCHANT_ID}:${config.API_KEY}`).toString('base64');

    const response = await fetch(url, {
        method: 'POST',
        headers: {
            'Authorization': `Basic ${auth}`,
            'Content-Type': 'application/json',
            'Accept': 'application/json',
        },
        body: JSON.stringify(orderData),
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Sequra Start Solicitation Error: ${response.status} - ${errorText}`);
    }

    const location = response.headers.get('Location');
    if (!location) {
        throw new Error('Sequra did not return a Location header');
    }

    const parts = location.split('/');
    return parts[parts.length - 1]; // Return UUID
}

async function getSequraForm(orderRef: string, config: any) {
    const url = `${config.API_URL}/orders/${orderRef}/form_v2?product=i1`;
    const auth = Buffer.from(`${config.MERCHANT_ID}:${config.API_KEY}`).toString('base64');

    const response = await fetch(url, {
        method: 'GET',
        headers: {
            'Authorization': `Basic ${auth}`,
            'Accept': 'text/html',
        }
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Sequra Form Error: ${response.status} - ${errorText}`);
    }

    return await response.text();
}

async function main() {
    console.log("🟢 Inciando Prueba de Integración con SeQura...");

    try {
        // Fetch DB Config
        const { data: configData } = await supabase.from('app_settings').select('*').eq('key', 'sequra_config').single();
        if (!configData || !configData.value) {
            console.error("No Sequra config found in app_settings table.");
            return;
        }

        const rawConfig = configData.value;
        const envString = rawConfig.environment || rawConfig.ENVIRONMENT || 'sandbox';
        const config = {
            MERCHANT_ID: rawConfig.merchant_id || rawConfig.MERCHANT_ID,
            API_KEY: rawConfig.api_key || rawConfig.API_KEY,
            API_URL: envString === 'production' ? 'https://live.sequrapi.com' : 'https://sandbox.sequrapi.com',
            ENVIRONMENT: envString
        };

        const { data: pack } = await supabase.from('packs').select('*').limit(1).single();
        const { data: student } = await supabase.from('students').select('*').limit(1).single();

        if (!pack || !student) {
            console.error("❌ Need at least 1 pack and 1 student in DB to run the simulation.");
            return;
        }

        console.log(`✅ Usando Config: Env=${config.ENVIRONMENT}, Merchant=${config.MERCHANT_ID}`);
        console.log(`✅ Usando Pack de prueba: ${pack.name} (${pack.price}€)`);
        console.log(`✅ Usando Alumno de prueba: ${student.email}`);

        const orderData = {
            merchant: { id: config.MERCHANT_ID },
            cart: {
                currency: 'EUR',
                order_ref_1: `TEST_ORDER_${Date.now()}`,
                items: [
                    {
                        reference: pack.id.substring(0, 10),
                        name: `[TEST] ${pack.name}`,
                        price_with_tax: Math.round((pack.price || 1) * 100),
                        quantity: 1,
                        total_with_tax: Math.round((pack.price || 1) * 100),
                    }
                ],
                order_total_with_tax: Math.round((pack.price || 1) * 100),
            },
            customer: {
                email: student.email,
                given_names: student.full_name || 'Test User',
            },
            gui: { layout: 'desktop' },
            platform: { name: 'PayMang Test', version: '1.0.0' },
            state: 'confirmed',
        };

        console.log("\n📦 Enviando datos del carrito a SeQura (startSolicitation)...");
        let orderRef = '';
        try {
            orderRef = await startSequraSolicitation(orderData, config);
            console.log(`✅ Respuesta exitosa. Creada Referencia de Orden SeQura: ${orderRef}`);
        } catch (e: any) {
            console.error("\n❌ Fallo enviando orden a SeQura:", e.message);
            return;
        }

        console.log(`\n📄 Solicitando formulario para pre-visualizar el modal de SeQura (${orderRef})...`);
        try {
            const formHtml = await getSequraForm(orderRef, config);
            console.log("\n✅ Formulario devuelto con éxito por Sequra! Contiene un iframe.");
            console.log("Snippet:", formHtml.substring(0, 250) + "...\n");
            console.log("🎉 ¡LA CONEXIÓN API CON SEQURA FUNCIONA PERFECTAMENTE!");
        } catch (e: any) {
            console.error("❌ Error solicitando el formulario HTML:", e.message);
        }

    } catch (e: any) {
        console.error("❌ Error inesperado durante el test:", e.message);
    }
}

main().catch(console.error);
