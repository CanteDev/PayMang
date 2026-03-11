-- Migration: revert_sales_rls_policy_due_to_recursion.sql
DROP POLICY IF EXISTS "sales_select_own" ON sales;
CREATE POLICY "sales_select_own" ON sales FOR SELECT USING (
  (coach_id = auth.uid()) OR 
  (closer_id = auth.uid()) OR 
  (setter_id = auth.uid()) OR 
  (((metadata ->> 'closer_id'::text))::uuid = auth.uid()) OR 
  (((metadata ->> 'coach_id'::text))::uuid = auth.uid()) OR 
  (((metadata ->> 'setter_id'::text))::uuid = auth.uid())
);
