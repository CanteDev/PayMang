-- Migration: Update Sales and Commissions for Multi-Agent Attribution
-- Description: Adds closer/coach/setter columns to sales and updates commission trigger to prioritize them.

BEGIN;

-- 1. Add agent columns to sales table if they don't exist
ALTER TABLE public.sales
ADD COLUMN IF NOT EXISTS closer_id UUID REFERENCES public.profiles(id),
ADD COLUMN IF NOT EXISTS coach_id UUID REFERENCES public.profiles(id),
ADD COLUMN IF NOT EXISTS setter_id UUID REFERENCES public.profiles(id);

-- 2. Update existing sales to use agents from students table (migration fallback)
UPDATE public.sales s
SET 
  closer_id = st.closer_id,
  coach_id = st.assigned_coach_id,
  setter_id = st.setter_id
FROM public.students st
WHERE s.student_id = st.id
AND s.closer_id IS NULL;

-- 3. RLS Policies for Closers to Insert Sales and Payments
-- Allow Closers to insert sales
CREATE POLICY "sales_insert_closer" ON public.sales
    FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE id = auth.uid() AND role = 'closer'
        )
    );

-- Allow Closers to delete their own sales (just in case they made a mistake)
CREATE POLICY "sales_delete_closer_own" ON public.sales
    FOR DELETE
    USING (
        closer_id = auth.uid()
    );

-- Allow Closers to insert payments (for installments generation)
CREATE POLICY "payments_insert_closer" ON public.payments
    FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE id = auth.uid() AND role = 'closer'
        )
    );

-- 4. Update Commission Generation Function to prioritize Sales agents
CREATE OR REPLACE FUNCTION generate_commissions_on_payment()
RETURNS TRIGGER AS $$
DECLARE
    v_student RECORD;
    v_sale RECORD;
    v_rates JSONB;
    v_rate NUMERIC;
    v_coach_id UUID;
    v_closer_id UUID;
    v_setter_id UUID;
BEGIN
    -- Logic triggers on 'paid' status
    
    -- 1. Get student details (for default fallback)
    SELECT * INTO v_student FROM students WHERE id = NEW.student_id;
    
    -- 2. Get sale details (primary source for agents)
    SELECT * INTO v_sale FROM sales WHERE id = NEW.sale_id;
    
    -- 3. Determine Agent IDs (Sale Agent > Student Agent)
    v_coach_id := COALESCE(v_sale.coach_id, v_student.assigned_coach_id);
    v_closer_id := COALESCE(v_sale.closer_id, v_student.closer_id);
    v_setter_id := COALESCE(v_sale.setter_id, v_student.setter_id);
    
    -- 4. Get rates from settings
    SELECT value INTO v_rates FROM app_settings WHERE key = 'commission_rates';
    
    -- Safety check: if rates not found, use default 0
    IF v_rates IS NULL THEN
        v_rates := '{"coach": 0, "closer": 0, "setter": 0}'::jsonb;
    END IF;

    -- 5. Create commissions for assigned agents
    
    -- COACH
    IF v_coach_id IS NOT NULL THEN
        v_rate := COALESCE((v_rates->>'coach')::NUMERIC, 0);
        IF v_rate > 0 THEN
            INSERT INTO commissions (
                payment_id,
                agent_id,
                role_at_sale,
                amount,
                status,
                milestone
            ) VALUES (
                NEW.id,
                v_coach_id,
                'coach',
                ROUND(NEW.amount * v_rate, 2),
                'pending',
                1
            );
        END IF;
    END IF;

    -- CLOSER
    IF v_closer_id IS NOT NULL THEN
        v_rate := COALESCE((v_rates->>'closer')::NUMERIC, 0);
        IF v_rate > 0 THEN
            INSERT INTO commissions (
                payment_id,
                agent_id,
                role_at_sale,
                amount,
                status,
                milestone
            ) VALUES (
                NEW.id,
                v_closer_id,
                'closer',
                ROUND(NEW.amount * v_rate, 2),
                'pending',
                1
            );
        END IF;
    END IF;

    -- SETTER
    IF v_setter_id IS NOT NULL THEN
        v_rate := COALESCE((v_rates->>'setter')::NUMERIC, 0);
        IF v_rate > 0 THEN
            INSERT INTO commissions (
                payment_id,
                agent_id,
                role_at_sale,
                amount,
                status,
                milestone
            ) VALUES (
                NEW.id,
                v_setter_id,
                'setter',
                ROUND(NEW.amount * v_rate, 2),
                'pending',
                1
            );
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

COMMIT;
