-- Add closer_id field to students table
-- This allows tracking which closer is assigned to each student

ALTER TABLE students
ADD COLUMN closer_id UUID REFERENCES profiles(id) ON DELETE SET NULL;

-- Create index for better query performance
CREATE INDEX idx_students_closer ON students(closer_id);

-- Add comment
COMMENT ON COLUMN students.closer_id IS 'The closer assigned to this student';
