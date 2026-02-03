-- Migration to allow Admins to manage all user content
-- This fixes issues where admins impersonating users could not delete or update content

-- 1. Helper function to check if a user is an admin
CREATE OR REPLACE FUNCTION is_admin(user_id uuid)
RETURNS boolean AS $$
  SELECT EXISTS (
    SELECT 1 FROM users
    WHERE id = user_id AND role = 'admin'
  );
$$ LANGUAGE sql SECURITY DEFINER;

-- 2. Update saved_contents policies
DO $$ 
BEGIN
    -- Drop existing policies to avoid conflicts
    DROP POLICY IF EXISTS "Users can read own saved contents" ON saved_contents;
    DROP POLICY IF EXISTS "Users can insert own saved contents" ON saved_contents;
    DROP POLICY IF EXISTS "Users can update own saved contents" ON saved_contents;
    DROP POLICY IF EXISTS "Users can delete own saved contents" ON saved_contents;
    DROP POLICY IF EXISTS "Anyone can read published contents" ON saved_contents;

    -- New policies with admin bypass
    CREATE POLICY "Users can read own saved contents"
      ON saved_contents FOR SELECT
      TO authenticated
      USING (user_id = auth.uid() OR is_admin(auth.uid()));

    CREATE POLICY "Users can insert own saved contents"
      ON saved_contents FOR INSERT
      TO authenticated
      WITH CHECK (user_id = auth.uid() OR is_admin(auth.uid()));

    CREATE POLICY "Users can update own saved contents"
      ON saved_contents FOR UPDATE
      TO authenticated
      USING (user_id = auth.uid() OR is_admin(auth.uid()))
      WITH CHECK (user_id = auth.uid() OR is_admin(auth.uid()));

    CREATE POLICY "Users can delete own saved contents"
      ON saved_contents FOR DELETE
      TO authenticated
      USING (user_id = auth.uid() OR is_admin(auth.uid()));

    CREATE POLICY "Anyone can read published contents"
      ON saved_contents FOR SELECT
      TO authenticated, anon
      USING (is_published = true AND public_id IS NOT NULL);
END $$;

-- 3. Update spelling_practice_lists policies
DO $$ 
BEGIN
    DROP POLICY IF EXISTS "Users can read own spelling practice lists" ON spelling_practice_lists;
    DROP POLICY IF EXISTS "Users can insert own spelling practice lists" ON spelling_practice_lists;
    DROP POLICY IF EXISTS "Users can update own spelling practice lists" ON spelling_practice_lists;
    DROP POLICY IF EXISTS "Users can delete own spelling practice lists" ON spelling_practice_lists;

    CREATE POLICY "Users can read own spelling practice lists"
      ON spelling_practice_lists FOR SELECT
      TO authenticated
      USING (user_id = auth.uid() OR is_admin(auth.uid()));

    CREATE POLICY "Users can insert own spelling practice lists"
      ON spelling_practice_lists FOR INSERT
      TO authenticated
      WITH CHECK (user_id = auth.uid() OR is_admin(auth.uid()));

    CREATE POLICY "Users can update own spelling practice lists"
      ON spelling_practice_lists FOR UPDATE
      TO authenticated
      USING (user_id = auth.uid() OR is_admin(auth.uid()))
      WITH CHECK (user_id = auth.uid() OR is_admin(auth.uid()));

    CREATE POLICY "Users can delete own spelling practice lists"
      ON spelling_practice_lists FOR DELETE
      TO authenticated
      USING (user_id = auth.uid() OR is_admin(auth.uid()));
END $$;

-- 4. Update proofreading_practices policies
DO $$ 
BEGIN
    DROP POLICY IF EXISTS "Admins can view all practices" ON proofreading_practices;
    DROP POLICY IF EXISTS "Admins can create practices" ON proofreading_practices;
    DROP POLICY IF EXISTS "Admins can update own practices" ON proofreading_practices;
    DROP POLICY IF EXISTS "Admins can delete own practices" ON proofreading_practices;
    DROP POLICY IF EXISTS "Students can view assigned practices" ON proofreading_practices;

    CREATE POLICY "Admins manage all practices"
      ON proofreading_practices FOR ALL
      TO authenticated
      USING (is_admin(auth.uid()));

    CREATE POLICY "Users view assigned practices"
      ON proofreading_practices FOR SELECT
      TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM proofreading_practice_assignments
          WHERE proofreading_practice_assignments.practice_id = proofreading_practices.id
          AND proofreading_practice_assignments.user_id = auth.uid()
        )
      );
END $$;
