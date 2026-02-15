-- Clean up existing data to avoid inconsistencies
TRUNCATE TABLE commissions, sales, students CASCADE;

-- Update Students Table for Installment Logic
ALTER TABLE students 
ADD COLUMN pack_id UUID REFERENCES packs(id),
ADD COLUMN payment_method TEXT CHECK (payment_method IN ('upfront', 'installments')) DEFAULT 'upfront',
ADD COLUMN total_installments INTEGER DEFAULT 1,
ADD COLUMN installment_amount NUMERIC(10,2) DEFAULT 0,
ADD COLUMN installment_period INTEGER DEFAULT 1, -- Months
ADD COLUMN start_date DATE DEFAULT CURRENT_DATE,
ADD COLUMN agreed_price NUMERIC(10,2) DEFAULT 0;

-- Create Payments Table
CREATE TABLE IF NOT EXISTS payments (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    amount NUMERIC(10,2) NOT NULL,
    status TEXT CHECK (status IN ('pending', 'paid', 'failed', 'cancelled', 'overdue')) DEFAULT 'pending',
    due_date DATE NOT NULL,
    paid_at TIMESTAMPTZ,
    method TEXT CHECK (method IN ('stripe', 'hotmart', 'transfer', 'cash', 'other')),
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS for Payments
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage all payments"
    ON payments FOR ALL
    USING (
        exists (select 1 from profiles where id = auth.uid() and role = 'admin')
    );

CREATE POLICY "Staff can view payments for their students"
    ON payments FOR SELECT
    USING (
        exists (
            select 1 from students s
            where s.id = payments.student_id
            and (s.assigned_coach_id = auth.uid() OR s.closer_id = auth.uid() OR s.setter_id = auth.uid())
        )
    );

-- Trigger to update 'updated_at'
CREATE TRIGGER update_payments_updated_at
    BEFORE UPDATE ON payments
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Function to generate installment plan
CREATE OR REPLACE FUNCTION create_installments_for_student()
RETURNS TRIGGER AS $$
BEGIN
    -- If strategy is 'installments' and config is valid
    IF NEW.payment_method = 'installments' AND NEW.total_installments > 0 THEN
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
                NEW.installment_amount,
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
            'pending', -- Or paid if we assume upfront is paid immediately? Let's leave as pending to be confirmed.
            NEW.start_date,
            'stripe', -- Default or null
            'Pago Único'
        );
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for student creation
CREATE TRIGGER trigger_create_installments
    AFTER INSERT ON students
    FOR EACH ROW
    EXECUTE FUNCTION create_installments_for_student();
