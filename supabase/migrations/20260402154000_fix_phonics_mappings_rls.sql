-- Fix phonics_mappings RLS policy to allow both admin and class_staff roles
-- The original policy only allowed 'admin', which caused silent update failures
-- and explicit insert failures for class_staff users.

DROP POLICY IF EXISTS "Admins can manage phonics_mappings" ON phonics_mappings;

CREATE POLICY "Staff can manage phonics_mappings"
  ON phonics_mappings FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
        AND users.role IN ('admin', 'class_staff')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
        AND users.role IN ('admin', 'class_staff')
    )
  );
