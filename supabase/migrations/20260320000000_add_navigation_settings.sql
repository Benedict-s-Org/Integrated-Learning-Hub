-- Add navigation_settings to system_config
INSERT INTO system_config (key, value)
VALUES (
  'navigation_settings',
  '{
    "learning": [
      {"id": "classDashboard", "label": "Class Dashboard", "visible": true},
      {"id": "new", "label": "Paragraph Memorization", "visible": true},
      {"id": "proofreading", "label": "Proofreading Exercise", "visible": true},
      {"id": "spelling", "label": "Spelling Practice", "visible": true},
      {"id": "spacedRepetition", "label": "Spaced Repetition", "visible": true},
      {"id": "readingComprehension", "label": "Reading Practice", "visible": true},
      {"id": "wordSnake", "label": "iPad Interactive Zone", "visible": true},
      {"id": "learningHub", "label": "My Learning Community", "visible": true},
      {"id": "notionHub", "label": "Notion Hub", "visible": true},
      {"id": "phonics", "label": "Phonics Sound Wall", "visible": true},
      {"id": "interactiveScanner", "label": "QR Up!", "visible": true}
    ],
    "progress": [
      {"id": "progress", "label": "Progress", "visible": true},
      {"id": "assignments", "label": "Assignments", "visible": true},
      {"id": "saved", "label": "Saved Content", "visible": true}
    ],
    "admin": [
      {"id": "adminUsers", "label": "Admin Panel", "visible": true},
      {"id": "adminAnalytics", "label": "Analytics Dashboard (Beta)", "visible": true},
      {"id": "superAdmin", "label": "Super Admin Panel", "visible": true},
      {"id": "homeworkRecord", "label": "Homework Record", "visible": true},
      {"id": "timetable", "label": "Timetable Management", "visible": true},
      {"id": "broadcast", "label": "Broadcast Management", "visible": true},
      {"id": "assignmentManagement", "label": "Assignment Management", "visible": true},
      {"id": "readingManagement", "label": "Reading Practice Management", "visible": true},
      {"id": "interactiveScannerAdmin", "label": "Interactive Scanner", "visible": true},
      {"id": "markerGenerator", "label": "Marker Generator", "visible": true},
      {"id": "legacyScanner", "label": "Legacy QR Scanner", "visible": true},
      {"id": "furnitureStudio", "label": "Furniture Studio", "visible": true},
      {"id": "assetUploader", "label": "Asset Uploader", "visible": true},
      {"id": "furnitureEditor", "label": "Furniture Editor", "visible": true},
      {"id": "spaceDesign", "label": "Space Design Center", "visible": true},
      {"id": "mapEditor", "label": "Map Editor", "visible": true},
      {"id": "aiIllustrator", "label": "AI Illustrator (Flowith)", "visible": true},
      {"id": "multiFormatUpload", "label": "Multi-format Upload", "visible": true},
      {"id": "uiBuilder", "label": "UI Builder", "visible": true},
      {"id": "themeDesigner", "label": "Theme Designer", "visible": true},
      {"id": "avatarBuilderStudio", "label": "Avatar Builder Studio", "visible": true},
      {"id": "avatarAssetManager", "label": "Avatar Asset Manager", "visible": true},
      {"id": "legacyDashboard", "label": "Legacy Dashboard", "visible": true},
      {"id": "groupCompetition", "label": "Group Competition (6-Lane)", "visible": true},
      {"id": "database", "label": "Database", "visible": true},
      {"id": "userProgress", "label": "User Progress", "visible": true},
      {"id": "mobileTest", "label": "Mobile Test", "visible": true}
    ]
  }'
)
ON CONFLICT (key) DO UPDATE
SET value = EXCLUDED.value;

-- Ensure RLS allows reading navigation_settings
DROP POLICY IF EXISTS "Public can read navigation settings" ON system_config;
CREATE POLICY "Public can read navigation settings"
  ON system_config
  FOR SELECT
  TO public
  USING (key = 'navigation_settings');
