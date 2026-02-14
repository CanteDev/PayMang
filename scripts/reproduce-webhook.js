const fs = require('fs');
require('dotenv').config({ path: '.env' });

const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
const appUrl = 'http://localhost:3000';

if (!webhookSecret) {
    console.error('Missing STRIPE_WEBHOOK_SECRET');
    process.exit(1);
}

// Data from the latest link fetch
const linkId = 'HPnyBSiL';
const studentId = '1bd09845-8922-4d9b-ac2f-24889a83d0f3';
const packId = 'bca057dd-486d-41da-b9de-6e6097bc9a43';

// Mock payload for checkout.session.completed
const payload = {
    id: 'evt_test_webhook_repro',
    object: 'event',
    type: 'checkout.session.completed',
    created: Math.floor(Date.now() / 1000),
    data: {
        object: {
            id: 'cs_test_repro_session_123',
            object: 'checkout.session',
            amount_total: 10000,
            currency: 'eur',
            payment_status: 'paid',
            status: 'complete',
            customer: 'cus_test_repro',
            payment_intent: 'pi_test_repro',
            metadata: {
                link_id: linkId,
                student_id: studentId,
                pack_id: packId,
                source: 'paymang_link'
            }
        }
    }
};

async function sendWebhook() {
    console.log('Sending webhook...');

    try {
        const response = await fetch(`${appUrl}/api/webhooks/stripe`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                // We are not simulating the signature verification since the handler 
                // currently skips it or enters the "TODO" block if we don't provide a valid signature.
                // However, the handler explicitly checks: if (!sig) return 400.
                // So we MUST provide a fake signature to pass that check.
                // Since verification is commented out, any string should pass the check "if (!sig)".
                'stripe-signature': 't=123,v1=fake_signature'
            },
            body: JSON.stringify(payload)
        });

        console.log(`Response Status: ${response.status}`);
        const text = await response.text();
        console.log(`Response Body: ${text}`);

    } catch (error) {
        console.error('Error sending webhook:', error);
    }
}

sendWebhook();
