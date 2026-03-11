-- Fix RLS policy in sales table so Coaches, Closers and Setters can see sales for their assigned students
DROP POLICY IF EXISTS "sales_select_own" ON sales;
CREATE POLICY "sales_select_own" ON sales 
FOR SELECT 
USING (
  (coach_id = auth.uid()) OR 
  (closer_id = auth.uid()) OR 
  (setter_id = auth.uid()) OR 
  (((metadata ->> 'closer_id'::text))::uuid = auth.uid()) OR 
  (((metadata ->> 'coach_id'::text))::uuid = auth.uid()) OR 
  (((metadata ->> 'setter_id'::text))::uuid = auth.uid()) OR
  (EXISTS ( SELECT 1 FROM students s WHERE s.id = sales.student_id AND (s.assigned_coach_id = auth.uid() OR s.closer_id = auth.uid() OR s.setter_id = auth.uid()) ))
);
