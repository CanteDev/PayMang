-- Migration: Simplify Installment Generation
-- Description: Updates the trigger function to calculate cuota amount from agreed_price and total_installments.

CREATE OR REPLACE FUNCTION create_installments_for_student()
RETURNS TRIGGER AS $$
DECLARE
    v_cuota_amount NUMERIC(10,2);
BEGIN
    -- Calculate cuota amount if installments strategy
    IF NEW.payment_method = 'installments' AND NEW.total_installments > 0 THEN
        v_cuota_amount := ROUND(NEW.agreed_price / NEW.total_installments, 2);
        
        FOR i IN 1..NEW.total_installments LOOP
            INSERT INTO payments (
                student_id,
                amount,
                status,
                due_date,
                method,
                notes
            ) VALUES (
                NEW.id,
                v_cuota_amount,
                'pending',
                (NEW.start_date + (((i - 1) * NEW.installment_period) || ' months')::INTERVAL)::DATE,
                NULL,
                'Cuota ' || i || ' de ' || NEW.total_installments
            );
        END LOOP;
    ELSIF NEW.payment_method = 'upfront' THEN
        -- Create single payment expected
        INSERT INTO payments (
            student_id,
            amount,
            status,
            due_date,
            method,
            notes
        ) VALUES (
            NEW.id,
            NEW.agreed_price,
            'pending',
            NEW.start_date,
            'stripe', -- Default or null
            'Pago Único'
        );
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
