-- Add INSERT/UPDATE policies for Closers on students table

-- Allow Closers to INSERT new students
CREATE POLICY "students_insert_closer" ON students
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'closer'
    )
  );

-- Allow Closers to UPDATE students
CREATE POLICY "students_update_closer" ON students
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'closer'
    )
  );

-- Also ensure Admin policy is correct (it was ALL, so it should be fine, but good to double check)
-- "students_select_admin" was FOR ALL, which covers INSERT/UPDATE/DELETE.
