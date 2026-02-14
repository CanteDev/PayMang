-- Create app_settings table
CREATE TABLE IF NOT EXISTS public.app_settings (
    key TEXT PRIMARY KEY,
    value JSONB NOT NULL,
    category TEXT NOT NULL, -- 'payment', 'business', 'system'
    description TEXT,
    encrypted BOOLEAN DEFAULT false,
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

-- Policies
-- Admin can do everything
CREATE POLICY "Admins can manage settings" ON public.app_settings
    FOR ALL
    USING (
        auth.uid() IN (
            SELECT id FROM public.profiles WHERE role = 'admin'
        )
    );

-- Everyone (authenticated) can read non-encrypted settings? 
-- Or maybe only server-side actions read this?
-- For safety, let's allow read access to authenticated users for now, 
-- but filtering sensitive data should happen at API level or RLS if we separate tables.
-- Actually, keys like 'stripe_secret_key' should NEVER be readable by client.
-- So we should probably restriction read to Service Role or Admin ONLY.
-- Client-side config (like Stripe Publishable Key) should be fetched via a secure Action/API.

CREATE POLICY "Admins can view settings" ON public.app_settings
    FOR SELECT
    USING (
        auth.uid() IN (
            SELECT id FROM public.profiles WHERE role = 'admin'
        )
    );

-- Initial Seed Data (Safe defaults)
INSERT INTO public.app_settings (key, value, category, description)
VALUES 
    ('commission_rates', '{"coach": 0.10, "closer": 0.08, "setter": 0.01}', 'business', 'Porcentajes de comisión por rol'),
    ('sequra_milestones', '{"initial": 0.70, "second": 0.15, "final": 0.15}', 'business', 'Hitos de pago de SeQura'),
    ('company_info', '{"name": "PayMang", "currency": "EUR"}', 'system', 'Información general de la empresa')
ON CONFLICT (key) DO NOTHING;
