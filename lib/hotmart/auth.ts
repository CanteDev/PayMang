/**
 * Hotmart OAuth 2.0 Authentication
 * Handles token generation and caching
 */

interface HotmartTokenResponse {
    access_token: string;
    expires_in: number;
    token_type: string;
}

interface CachedToken {
    token: string;
    expiresAt: number;
}

let tokenCache: CachedToken | null = null;

import { getGatewayConfig } from '@/lib/settings-helper';

/**
 * Get Hotmart access token (with caching)
 */
export async function getHotmartToken(): Promise<string> {
    // Return cached token if still valid
    if (tokenCache && tokenCache.expiresAt > Date.now()) {
        return tokenCache.token;
    }

    const config = await getGatewayConfig('hotmart');

    // config has: client_id, client_secret, basic_auth, auth_url
    const authUrl = config.auth_url || process.env.HOTMART_AUTH_URL;
    const clientId = config.client_id;
    const clientSecret = config.client_secret;
    const basicAuth = config.basic_auth;

    if (!authUrl || !clientId || !clientSecret || !basicAuth) {
        throw new Error('Hotmart credentials not configured');
    }

    try {
        const response = await fetch(authUrl, {
            method: 'POST',
            headers: {
                'Authorization': basicAuth.startsWith('Basic ') ? basicAuth : `Basic ${basicAuth}`,
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: new URLSearchParams({
                grant_type: 'client_credentials',
                client_id: clientId,
                client_secret: clientSecret,
            }).toString(),
        });

        if (!response.ok) {
            const error = await response.text();
            throw new Error(`Hotmart auth failed: ${response.status} - ${error}`);
        }

        const data: HotmartTokenResponse = await response.json();

        // Cache token (expires 5 minutes before actual expiry for safety)
        tokenCache = {
            token: data.access_token,
            expiresAt: Date.now() + (data.expires_in - 300) * 1000,
        };

        return data.access_token;
    } catch (error) {
        console.error('Error getting Hotmart token:', error);
        throw error;
    }
}

/**
 * Clear token cache (useful for testing or manual refresh)
 */
export function clearHotmartTokenCache(): void {
    tokenCache = null;
}
