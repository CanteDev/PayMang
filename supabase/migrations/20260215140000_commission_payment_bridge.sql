-- Migration: Commission Payment Bridge
-- Description: Adds closer/setter to students, updates commissions to link to payments, and implements auto-commission trigger.

-- 1. Update Students Table with Agent Fields
ALTER TABLE students 
ADD COLUMN IF NOT EXISTS closer_id UUID REFERENCES profiles(id),
ADD COLUMN IF NOT EXISTS setter_id UUID REFERENCES profiles(id);

-- 2. Update Commissions Table
ALTER TABLE commissions
ADD COLUMN IF NOT EXISTS payment_id UUID REFERENCES payments(id),
ALTER COLUMN sale_id DROP NOT NULL;

-- Index for performance
CREATE INDEX IF NOT EXISTS idx_commissions_payment ON commissions(payment_id);

-- 3. Commission Generation Function
CREATE OR REPLACE FUNCTION generate_commissions_on_payment()
RETURNS TRIGGER AS $$
DECLARE
    v_student RECORD;
    v_rates JSONB;
    v_rate NUMERIC;
BEGIN
    -- Logic triggers on 'paid' status
    -- 1. Get student details (agents)
    SELECT * INTO v_student FROM students WHERE id = NEW.student_id;
    
    -- 2. Get rates from settings
    SELECT value INTO v_rates FROM app_settings WHERE key = 'commission_rates';
    
    -- Safety check: if rates not found, use default 0
    IF v_rates IS NULL THEN
        v_rates := '{"coach": 0, "closer": 0, "setter": 0}'::jsonb;
    END IF;

    -- 3. Create commissions for assigned agents
    
    -- COACH
    IF v_student.assigned_coach_id IS NOT NULL THEN
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
                v_student.assigned_coach_id,
                'coach',
                ROUND(NEW.amount * v_rate, 2),
                'pending',
                1
            );
        END IF;
    END IF;

    -- CLOSER
    IF v_student.closer_id IS NOT NULL THEN
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
                v_student.closer_id,
                'closer',
                ROUND(NEW.amount * v_rate, 2),
                'pending',
                1
            );
        END IF;
    END IF;

    -- SETTER
    IF v_student.setter_id IS NOT NULL THEN
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
                v_student.setter_id,
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

-- 4. Triggers
DROP TRIGGER IF EXISTS trigger_generate_commissions ON payments;
CREATE TRIGGER trigger_generate_commissions
    AFTER UPDATE ON payments
    FOR EACH ROW
    WHEN (NEW.status = 'paid' AND (OLD.status IS NULL OR OLD.status <> 'paid'))
    EXECUTE FUNCTION generate_commissions_on_payment();

DROP TRIGGER IF EXISTS trigger_generate_commissions_insert ON payments;
CREATE TRIGGER trigger_generate_commissions_insert
    AFTER INSERT ON payments
    FOR EACH ROW
    WHEN (NEW.status = 'paid')
    EXECUTE FUNCTION generate_commissions_on_payment();
