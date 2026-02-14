/*
════════════════════════════════════════════════════════════
  MIGRACIÓN 003: Añadir campo closer_id a tabla students
════════════════════════════════════════════════════════════

📋 INSTRUCCIONES:
1. Abre el SQL Editor de Supabase:
   https://supabase.com/dashboard/project/rjspuxdvpdwescrvudgz/sql

2. Copia TODO el contenido de este archivo (desde ALTER hasta el final)

3. Pégalo en el editor SQL

4. Haz clic en "Run" o "RUN"

5. Verifica que aparezca "Success" o "Query executed successfully"

════════════════════════════════════════════════════════════
*/

-- Add closer_id field to students table
ALTER TABLE students ADD COLUMN closer_id UUID REFERENCES profiles(id) ON DELETE SET NULL;

-- Create index for better query performance  
CREATE INDEX idx_students_closer ON students(closer_id);

-- Add comment
COMMENT ON COLUMN students.closer_id IS 'The closer assigned to this student';
