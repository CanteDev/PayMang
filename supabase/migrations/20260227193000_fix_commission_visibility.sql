-- 1. Redefine Sales Selection Policy to use top-level columns
DROP POLICY IF EXISTS "sales_select_own" ON sales;
CREATE POLICY "sales_select_own" ON sales
FOR SELECT USING (
    coach_id = auth.uid() OR 
    closer_id = auth.uid() OR 
    setter_id = auth.uid() OR
    (metadata->>'closer_id')::uuid = auth.uid() OR
    (metadata->>'coach_id')::uuid = auth.uid() OR
    (metadata->>'setter_id')::uuid = auth.uid()
);

-- 2. Redefine Students Selection for Coaches/Setters
-- Allow them to see students if they are assigned as coach/closer/setter in ANY of the student's sales
DROP POLICY IF EXISTS "students_select_coach" ON students;
CREATE POLICY "students_select_coach" ON students
FOR SELECT USING (
    assigned_coach_id = auth.uid() OR
    closer_id = auth.uid() OR
    setter_id = auth.uid() OR
    EXISTS (
        SELECT 1 FROM sales s 
        WHERE s.student_id = students.id 
        AND (s.coach_id = auth.uid() OR s.closer_id = auth.uid() OR s.setter_id = auth.uid())
    )
);

-- 3. Data Sync: Ensure metadata matches top-level columns for any legacy reasons
UPDATE sales 
SET metadata = jsonb_set(
    jsonb_set(
        jsonb_set(COALESCE(metadata, '{}'::jsonb), '{coach_id}', to_jsonb(coach_id::text)),
        '{closer_id}', to_jsonb(closer_id::text)
    ),
    '{setter_id}', to_jsonb(setter_id::text)
)
WHERE coach_id IS NOT NULL OR closer_id IS NOT NULL OR setter_id IS NOT NULL;

-- 4. Cleanup: Remove duplicate commissions with NULL payment_id
-- but ONLY if a properly linked commission (with payment_id) already exists for the same sale/agent/role/amount
DELETE FROM commissions c1
WHERE c1.payment_id IS NULL
AND EXISTS (
    SELECT 1 FROM commissions c2
    WHERE c2.sale_id = c1.sale_id
    AND c2.agent_id = c1.agent_id
    AND c2.role_at_sale = c1.role_at_sale
    AND ABS(c2.amount - c1.amount) < 0.01  -- amount match
    AND c2.payment_id IS NOT NULL          -- it is the linked one
);
