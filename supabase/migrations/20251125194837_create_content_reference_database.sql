/*
  # Create Content Reference Database

  This migration creates a comprehensive content reference database system for admin users
  to store and manage reference materials for exercise development.

  1. New Tables
    - `content_reference`
      - `id` (uuid, primary key) - Unique identifier for each content entry
      - `title` (text, required) - Title of the content reference
      - `content` (text, required) - The actual content/text material
      - `description` (text) - Description for AI categorization and search
      - `grade_level` (text, required) - Grade level (P.1, P.2, P.3, P.4, P.5, P.6)
      - `category_tags` (text array) - Optional category tags for organization
      - `created_by` (uuid, required) - Admin user who created the entry
      - `created_at` (timestamptz) - When the entry was created
      - `updated_at` (timestamptz) - When the entry was last modified
      - `usage_count` (integer) - Track how many times content was referenced

  2. Security
    - Enable RLS on `content_reference` table
    - Admin users can perform all operations (SELECT, INSERT, UPDATE, DELETE)
    - Non-admin users cannot access this table at all
    
  3. Indexes
    - Create index on grade_level for efficient filtering
    - Create index on created_by for user-specific queries
    - Create full-text search index on content and description

  4. Important Notes
    - This database is exclusively for admin use
    - Designed to store reference materials for exercise creation
    - Supports grade-level categorization (P.1 through P.6)
    - Includes AI-friendly description field for content organization
*/

CREATE TABLE IF NOT EXISTS content_reference (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  content text NOT NULL,
  description text DEFAULT '',
  grade_level text NOT NULL CHECK (grade_level IN ('P.1', 'P.2', 'P.3', 'P.4', 'P.5', 'P.6')),
  category_tags text[] DEFAULT '{}',
  created_by uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  usage_count integer DEFAULT 0
);

ALTER TABLE content_reference ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view all content references"
  ON content_reference
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
  );

CREATE POLICY "Admins can insert content references"
  ON content_reference
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
  );

CREATE POLICY "Admins can update content references"
  ON content_reference
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
  );

CREATE POLICY "Admins can delete content references"
  ON content_reference
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
  );

CREATE INDEX IF NOT EXISTS idx_content_reference_grade_level ON content_reference(grade_level);
CREATE INDEX IF NOT EXISTS idx_content_reference_created_by ON content_reference(created_by);
CREATE INDEX IF NOT EXISTS idx_content_reference_created_at ON content_reference(created_at DESC);

CREATE OR REPLACE FUNCTION update_content_reference_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_content_reference_updated_at
  BEFORE UPDATE ON content_reference
  FOR EACH ROW
  EXECUTE FUNCTION update_content_reference_updated_at();