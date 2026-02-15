-- Migration: Final Database Fix for Payment Model
-- Description: Ensures all required columns exist in students table for the new payment model.

ALTER TABLE students 
ADD COLUMN IF NOT EXISTS pack_id UUID REFERENCES packs(id),
ADD COLUMN IF NOT EXISTS payment_method TEXT CHECK (payment_method IN ('upfront', 'installments')) DEFAULT 'upfront',
ADD COLUMN IF NOT EXISTS total_installments INTEGER DEFAULT 1,
ADD COLUMN IF NOT EXISTS installment_period INTEGER DEFAULT 1,
ADD COLUMN IF NOT EXISTS start_date DATE DEFAULT CURRENT_DATE,
ADD COLUMN IF NOT EXISTS agreed_price NUMERIC(10,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS closer_id UUID REFERENCES profiles(id),
ADD COLUMN IF NOT EXISTS setter_id UUID REFERENCES profiles(id);

-- Verify payments table exists with correct schema
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
