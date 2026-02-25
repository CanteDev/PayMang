import { getAppConfig } from './config/server-config';

interface HotmartTokenResponse {
    access_token: string;
    token_type: string;
    expires_in: number;
    scope: string;
    jti: string;
}

/**
 * Singleton class to handle Hotmart API interactions
 */
export class HotmartClient {
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
            const config = await getAppConfig('hotmart_config');
            console.log("DB HOTMART CONFIG: ", JSON.stringify(config));

            // Prioritize Basic Auth if available (as provided by user)
            // Otherwise construct from Client ID + Secret
            let authHeader = config.BASIC_AUTH || config.basic_auth;

            // Auto-prepend 'Basic ' if user only pasted the base64 string
            if (authHeader && !authHeader.toLowerCase().startsWith('basic ')) {
                authHeader = `Basic ${authHeader}`;
            }

            if (!authHeader && (config.CLIENT_ID || config.client_id) && (config.CLIENT_SECRET || config.client_secret)) {
                const clientId = config.CLIENT_ID || config.client_id;
                const clientSecret = config.CLIENT_SECRET || config.client_secret;
                const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
                authHeader = `Basic ${credentials}`;
            }

            if (!authHeader) {
                throw new Error('Hotmart credentials not configured (Missing Basic Auth or Client ID/Secret)');
            }

            const authUrl = 'https://api-sec-vlc.hotmart.com/security/oauth/token';

            const response = await fetch(`${authUrl}?grant_type=client_credentials`, {
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
        const config = await getAppConfig('hotmart_config');

        // Hotmart domains for API v1/v2
        // Use the API_URL from config or fallback
        const baseUrl = config.API_URL || config.api_url || 'https://sandbox.hotmart.com/payments/api/v1';

        // Check if endpoint is already an absolute URL
        let url = endpoint;
        if (!endpoint.startsWith('http')) {
            // ensure endpoint starts with /
            const formattedEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
            url = `${baseUrl}${formattedEndpoint}`;
        }

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

        const rawText = await response.text();
        try {
            return JSON.parse(rawText);
        } catch (e) {
            console.error(`Error parsing JSON from Hotmart. Raw response: ${rawText.substring(0, 200)}...`);
            throw new Error(`Invalid JSON response from Hotmart API: ${rawText.substring(0, 100)}`);
        }
    }
}

export const hotmart = HotmartClient.getInstance();
