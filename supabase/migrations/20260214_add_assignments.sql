
-- Add missing assignment columns to students table

-- Add closer_id if not exists
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'students' AND column_name = 'closer_id') THEN
        ALTER TABLE students ADD COLUMN closer_id UUID REFERENCES profiles(id);
        CREATE INDEX idx_students_closer ON students(closer_id);
    END IF;
END $$;

-- Add setter_id if not exists
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'students' AND column_name = 'setter_id') THEN
        ALTER TABLE students ADD COLUMN setter_id UUID REFERENCES profiles(id);
        CREATE INDEX idx_students_setter ON students(setter_id);
    END IF;
END $$;
