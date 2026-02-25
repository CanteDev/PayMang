import * as dotenv from 'dotenv';
dotenv.config();
dotenv.config({ path: '.env.local' });
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function main() {
    console.log("Testing Hotmart Pago Inteligente Webhook...");

    // 1. Get an existing generated payment link or create one
    let { data: link, error } = await supabase.from('payment_links').select('id, pack_id').limit(1).single();

    if (error || !link) {
        console.log("No payment links found. Creating one...");
        const { data: pack } = await supabase.from('packs').select('id').limit(1).single();
        const { data: student } = await supabase.from('students').select('id').limit(1).single();
        const { data: profile } = await supabase.from('profiles').select('id').limit(1).single();

        if (!pack || !student || !profile) {
            console.error("Missing pack, student, or profile to create test link.");
            return;
        }

        link = await (supabase.from('payment_links') as any).insert({
            id: 'webhook_test_link',
            pack_id: pack.id,
            student_id: student.id,
            created_by: profile.id,
            gateway: 'hotmart',
            status: 'pending'
        }).select().single().then((res: any) => res.data);
    }

    console.log(`Using Link ID: ${link.id}`);

    // Simulate "Pago Inteligente" (Intelligent Installment) Payload
    // In Hotmart, recurrent payments / installments come as individual PURCHASE_APPROVED events
    // but with specific recurrence fields.
    const payload = {
        "id": "event_12345",
        "creation_date": new Date().toISOString(),
        "event": "PURCHASE_APPROVED",
        "version": "2.0.0",
        "data": {
            "product": {
                "id": 12345,
                "ucode": "04c268a1-b898-478d-98cd-aae1a892470c",
                "name": "Test Product",
                // Intelligent Installment indicates it's a recurrence plan
                "has_co_production": false
            },
            "commissions": [
                {
                    "value": 150.00,
                    "currency_value": "EUR",
                    "source": "PRODUCER"
                }
            ],
            "purchase": {
                "approved_date": new Date().toISOString().split('T')[0],
                "full_price": {
                    "value": 350.00,
                    "currency_value": "EUR"
                },
                "price": {
                    "value": 350.00,
                    "currency_value": "EUR"
                },
                "checkout_country": {
                    "name": "España",
                    "iso": "ES"
                },
                "order_bump": {
                    "is_order_bump": false
                },
                "original_offer_price": {
                    "value": 1050.00, // Total value of the intelligent payment plan
                    "currency_value": "EUR"
                },
                "payment": {
                    "installments_number": 3,
                    "type": "CREDIT_CARD"
                },
                "offer": {
                    "code": "TEST_OFFER"
                },
                "transaction": `HP${Math.floor(Math.random() * 1000000000)}`,
                "status": "APPROVED",
                "is_subscription": true,
                "subscription_anticipation_purchase": false,
                "sck": link.id, // Emulating custom tracking
                "src": link.id, // Emulating custom tracking
            },
            "buyer": {
                "email": "testbuyer@example.com",
                "name": "Test Buyer"
            },
            "producer": {
                "name": "Producer Name"
            }
        }
    };

    console.log("Sending Webhook payload locally...");
    try {
        const response = await fetch('http://localhost:3000/api/webhooks/hotmart', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                // Local test, signature check currently bypassed
                'x-hotmart-hottok': process.env.HOTMART_WEBHOOK_SECRET || 'test'
            },
            body: JSON.stringify(payload)
        });

        const result = await response.json();
        console.log("Webhook Response:", response.status, result);

        // Lets verify DB
        console.log("Verifying Sales entry...");
        const { data: sale } = await supabase.from('sales').select('*').eq('transaction_id', payload.data.purchase.transaction).single();
        if (sale) {
            console.log(`✅ Sale recorded successfully! ID: ${sale.id}, Total Amount: ${sale.total_amount}`);
        } else {
            console.log("❌ Sale was NOT recorded!");
        }

    } catch (err: any) {
        console.error("Fetch Error:", err.message);
    }
}

main().catch(console.error);
