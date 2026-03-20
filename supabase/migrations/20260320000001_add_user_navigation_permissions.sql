-- Migration: Add User-Specific Navigation Permissions
-- This adds a navigation_permissions JSONB column to the users table to allow granular control.

-- 1. Add the column to public.users
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'navigation_permissions'
  ) THEN
    ALTER TABLE public.users ADD COLUMN navigation_permissions JSONB DEFAULT '{}'::jsonb;
  END IF;
END $$;

-- 2. Update existing admins to have full permissions (optional but helpful)
-- Note: admins will likely still see everything based on role, but we can seed it.
UPDATE public.users 
SET navigation_permissions = '{
  "classDashboard": true,
  "new": true,
  "proofreading": true,
  "spelling": true,
  "spacedRepetition": true,
  "readingComprehension": true,
  "wordSnake": true,
  "learningHub": true,
  "notionHub": true,
  "phonics": true,
  "interactiveScanner": true,
  "progress": true,
  "assignments": true,
  "saved": true,
  "adminUsers": true,
  "adminAnalytics": true,
  "superAdmin": true,
  "homeworkRecord": true,
  "timetable": true,
  "broadcast": true,
  "assignmentManagement": true,
  "readingManagement": true,
  "interactiveScannerAdmin": true,
  "markerGenerator": true,
  "legacyScanner": true,
  "furnitureStudio": true,
  "assetUploader": true,
  "furnitureEditor": true,
  "spaceDesign": true,
  "mapEditor": true,
  "aiIllustrator": true,
  "multiFormatUpload": true,
  "uiBuilder": true,
  "themeDesigner": true,
  "avatarBuilderStudio": true,
  "avatarAssetManager": true,
  "legacyDashboard": true,
  "groupCompetition": true,
  "database": true,
  "userProgress": true,
  "mobileTest": true
}'::jsonb
WHERE role = 'admin';

-- 3. Update the sync trigger function to handle the new column
-- We'll just ensure it keeps the default {} for new users.
-- (The existing INSERT already handles default values if not specified)
