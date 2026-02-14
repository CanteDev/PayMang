/**
 * Hotmart Checkout API
 * Creates payment orders via Hotmart API
 */

import { getHotmartToken } from './auth';

interface HotmartCheckoutParams {
    productId: string;
    offerId: string;
    customerName: string;
    customerEmail: string;
    phoneLocalCode?: string;
    phoneNumber?: string;
    price: number;
    currency?: string;
    customFields: Record<string, string>;
}

interface HotmartCheckoutResponse {
    checkout_url: string;
    sale_id: string;
}

/**
 * Create a Hotmart checkout order
 */
export async function createHotmartCheckout(
    params: HotmartCheckoutParams
): Promise<HotmartCheckoutResponse> {
    const apiUrl = process.env.HOTMART_API_URL;

    if (!apiUrl) {
        throw new Error('HOTMART_API_URL not configured');
    }

    const token = await getHotmartToken();

    try {
        const response = await fetch(`${apiUrl}/sales`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                product: params.productId,
                offer: params.offerId,
                name: params.customerName,
                email: params.customerEmail,
                phone_local_code: params.phoneLocalCode || '34',
                phone_number: params.phoneNumber || '',
                price: {
                    value: params.price,
                    currency_code: params.currency || 'EUR',
                },
                custom_fields: params.customFields,
            }),
        });

        if (!response.ok) {
            const error = await response.text();
            throw new Error(`Hotmart checkout creation failed: ${response.status} - ${error}`);
        }

        const data = await response.json();
        return {
            checkout_url: data.checkout_url,
            sale_id: data.sale_id,
        };
    } catch (error) {
        console.error('Error creating Hotmart checkout:', error);
        throw error;
    }
}

/**
 * Refund a Hotmart sale
 */
export async function refundHotmartSale(transactionId: string): Promise<boolean> {
    const apiUrl = process.env.HOTMART_API_URL;

    if (!apiUrl) {
        throw new Error('HOTMART_API_URL not configured');
    }

    const token = await getHotmartToken();

    try {
        // Endpoint: /payments/api/v1/sales/{transaction}/refund
        // According to API docs, this should be PUT
        const response = await fetch(`${apiUrl}/sales/${transactionId}/refund`, {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
            },
        });

        if (!response.ok) {
            const error = await response.text();
            console.error(`Hotmart refund failed: ${response.status} - ${error}`);
            throw new Error(`Hotmart refund failed: ${response.status} - ${error}`);
        }

        return true;
    } catch (error) {
        console.error('Error refunding Hotmart sale:', error);
        throw error;
    }
}
