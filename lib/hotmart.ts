import { CONFIG } from '@/config/app.config';

interface HotmartTokenResponse {
    access_token: string;
    token_type: string;
    expires_in: number;
    scope: string;
}

/**
 * Singleton class to handle Hotmart API interactions
 */
class HotmartClient {
    private static instance: HotmartClient;
    private accessToken: string | null = null;
    private tokenExpiration: number = 0;

    private constructor() { }

    public static getInstance(): HotmartClient {
        if (!HotmartClient.instance) {
            HotmartClient.instance = new HotmartClient();
        }
        return HotmartClient.instance;
    }

    /**
     * Retrieves a valid access token, refreshing it if necessary
     */
    private async getAccessToken(): Promise<string> {
        const now = Date.now();
        if (this.accessToken && this.tokenExpiration > now) {
            return this.accessToken;
        }

        try {
            // Prioritize Basic Auth if available (as provided by user)
            // Otherwise construct from Client ID + Secret
            let authHeader = CONFIG.GATEWAYS.HOTMART.BASIC_AUTH;

            if (!authHeader && CONFIG.GATEWAYS.HOTMART.CLIENT_ID && CONFIG.GATEWAYS.HOTMART.CLIENT_SECRET) {
                const credentials = Buffer.from(
                    `${CONFIG.GATEWAYS.HOTMART.CLIENT_ID}:${CONFIG.GATEWAYS.HOTMART.CLIENT_SECRET}`
                ).toString('base64');
                authHeader = `Basic ${credentials}`;
            }

            if (!authHeader) {
                throw new Error('Hotmart credentials not configured (Missing Basic Auth or Client ID/Secret)');
            }

            const response = await fetch(`${CONFIG.GATEWAYS.HOTMART.AUTH_URL}?grant_type=client_credentials`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': authHeader,
                },
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`Failed to authenticate with Hotmart: ${response.status} ${errorText}`);
            }

            const data: HotmartTokenResponse = await response.json();

            this.accessToken = data.access_token;
            // Set expiration slightly before actual expiry to be safe (e.g. - 60 seconds)
            this.tokenExpiration = now + (data.expires_in * 1000) - 60000;

            return this.accessToken;
        } catch (error) {
            console.error('Error getting Hotmart access token:', error);
            throw error;
        }
    }

    /**
     * Generic method to make authenticated requests to Hotmart API
     */
    public async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
        const token = await this.getAccessToken();
        const url = `${CONFIG.GATEWAYS.HOTMART.API_URL}${endpoint.startsWith('/') ? '' : '/'}${endpoint}`;

        const headers = {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
            ...options.headers,
        };

        const response = await fetch(url, {
            ...options,
            headers,
        });

        if (!response.ok) {
            // Handle 401 explicitly?
            if (response.status === 401) {
                // Token might be invalid, reset and retry once?
                this.accessToken = null;
                // Recursive retry logic could go here, but for now just throw
            }
            const errorText = await response.text();
            throw new Error(`Hotmart API error [${response.status}]: ${errorText}`);
        }

        // Some endpoints might return empty body
        if (response.status === 204) {
            return {} as T;
        }

        return response.json();
    }
}

export const hotmart = HotmartClient.getInstance();
