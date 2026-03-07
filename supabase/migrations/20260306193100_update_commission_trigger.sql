-- Migration: Update Commission Trigger with Sales Overrides
-- Description: Updates generate_commissions_on_payment to prioritize commission rates from the sale record.

BEGIN;

CREATE OR REPLACE FUNCTION generate_commissions_on_payment()
RETURNS TRIGGER AS $$
DECLARE
    v_student RECORD;
    v_sale    RECORD;
    v_rates   JSONB;
    v_rate_coach  NUMERIC;
    v_rate_closer NUMERIC;
    v_rate_setter NUMERIC;
    v_coach_id  UUID;
    v_closer_id UUID;
    v_setter_id UUID;
BEGIN
    SELECT * INTO v_student FROM students WHERE id = NEW.student_id;
    SELECT * INTO v_sale    FROM sales    WHERE id = NEW.sale_id;

    v_coach_id  := COALESCE(v_sale.coach_id,  v_student.assigned_coach_id);
    v_closer_id := COALESCE(v_sale.closer_id, v_student.closer_id);
    v_setter_id := COALESCE(v_sale.setter_id, v_student.setter_id);

    SELECT value INTO v_rates FROM app_settings WHERE key = 'commission_rates';
    IF v_rates IS NULL THEN
        v_rates := '{"coach":0,"closer":0,"setter":0}'::jsonb;
    END IF;

    -- PRIORITY: sale override → global setting → 0
    v_rate_coach  := COALESCE(v_sale.commission_coach,  (v_rates->>'coach')::NUMERIC,  0);
    v_rate_closer := COALESCE(v_sale.commission_closer, (v_rates->>'closer')::NUMERIC, 0);
    v_rate_setter := COALESCE(v_sale.commission_setter, (v_rates->>'setter')::NUMERIC, 0);

    IF v_coach_id  IS NOT NULL AND v_rate_coach  > 0 THEN
        INSERT INTO commissions (payment_id, agent_id, role_at_sale, amount, status, milestone)
        VALUES (NEW.id, v_coach_id,  'coach',  ROUND(NEW.amount * v_rate_coach,  2), 'pending', 1);
    END IF;
    IF v_closer_id IS NOT NULL AND v_rate_closer > 0 THEN
        INSERT INTO commissions (payment_id, agent_id, role_at_sale, amount, status, milestone)
        VALUES (NEW.id, v_closer_id, 'closer', ROUND(NEW.amount * v_rate_closer, 2), 'pending', 1);
    END IF;
    IF v_setter_id IS NOT NULL AND v_rate_setter > 0 THEN
        INSERT INTO commissions (payment_id, agent_id, role_at_sale, amount, status, milestone)
        VALUES (NEW.id, v_setter_id, 'setter', ROUND(NEW.amount * v_rate_setter, 2), 'pending', 1);
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

COMMIT;
