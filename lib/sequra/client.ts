import { getGatewayConfig } from '@/lib/settings-helper';

interface SequraConfig {
    MERCHANT_ID: string;
    API_KEY: string;
    API_URL: string;
    ENVIRONMENT?: string;
}

async function getConfig(): Promise<SequraConfig> {
    const config = await getGatewayConfig('sequra');
    // Normalize keys just in case (DB vs Config file casing)
    return {
        MERCHANT_ID: config.merchant_id || config.MERCHANT_ID,
        API_KEY: config.api_key || config.API_KEY,
        API_URL: config.environment === 'production'
            ? 'https://live.sequrapi.com' // Check prod URL
            : 'https://sandbox.sequrapi.com',
        ENVIRONMENT: config.environment || 'sandbox'
    };
}

/**
 * Basic Sequra API Client
 */
export async function sequraRequest(endpoint: string, method: string = 'GET', body?: any) {
    const config = await getConfig();
    const url = `${config.API_URL}/${endpoint}`;

    // Auth: Basic Auth with username=merchantId, password=apiKey
    const auth = Buffer.from(`${config.MERCHANT_ID}:${config.API_KEY}`).toString('base64');

    const headers: Record<string, string> = {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json, text/html', // HTML needed for form
    };

    const options: RequestInit = {
        method,
        headers,
    };

    if (body) {
        options.body = JSON.stringify(body);
    }

    try {
        const response = await fetch(url, options);

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Sequra API Error: ${response.status} - ${errorText}`);
        }

        // Handle HTML response (for form)
        const contentType = response.headers.get('content-type');
        if (contentType && contentType.includes('text/html')) {
            return await response.text();
        }

        // Handle JSON response (for API)
        if (response.status === 204) return null; // No content
        return await response.json();

    } catch (error) {
        console.error('Sequra Request Failed:', error);
        throw error;
    }
}

/**
 * Start Solicitation (Create Order)
 * This initiates the checkout process.
 * Returns the Order Reference (UUID).
 */
export async function startSolicitation(orderData: any) {
    const config = await getConfig();
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

    // 201 Created -> Location header
    const location = response.headers.get('Location');
    if (!location) {
        // Fallback: Check if body has uuid
        const json = await response.json().catch(() => ({}));
        if (json.uuid) return json.uuid;

        throw new Error('Sequra did not return a Location header or UUID');
    }

    // Extract UUID from Location: .../orders/{uuid} or .../orders/{uuid}/form_v2
    // Usually: https://sandbox.sequrapi.com/orders/UUID
    const parts = location.split('/');
    // Filter out empty parts or query params
    // url structure: .../orders/UUID
    // Last part should be UUID.
    return parts[parts.length - 1];
}

/**
 * Fetch Identification Form
 * GET /orders/{order_ref}/form_v2
 */
export async function getIdentificationForm(orderRef: string, product: string = 'i1') {
    return await sequraRequest(`orders/${orderRef}/form_v2?product=${product}`, 'GET');
}

/**
 * Update Order (Delivery Report)
 * PUT /orders/{order_ref}
 * Used to report delivery or update stats.
 */
export async function updateOrder(orderRef: string, updateData: any) {
    return await sequraRequest(`orders/${orderRef}`, 'PUT', updateData);
}

/**
 * Get Order (Status Check)
 * GET /orders/{order_ref}
 * Note: Check actual endpoint availability. Retries allowed.
 */
export async function getOrder(orderRef: string) {
    return await sequraRequest(`orders/${orderRef}`, 'GET');
}
