-- Drop existing objects safely
DROP VIEW IF EXISTS common_errors;

DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'dev_error_log') THEN
        DROP TRIGGER IF EXISTS dev_error_log_updated ON dev_error_log;
        DROP POLICY IF EXISTS "Anyone can read error log" ON dev_error_log;
        DROP POLICY IF EXISTS "Admins can manage error log" ON dev_error_log;
    END IF;
END $$;

DROP FUNCTION IF EXISTS update_dev_error_log_timestamp();
DROP TABLE IF EXISTS dev_error_log;

-- Now recreate everything cleanly
CREATE TABLE IF NOT EXISTS dev_error_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Error classification
    category TEXT NOT NULL CHECK (category IN (
        'file_edit',
        'import_missing', 
        'type_mismatch',
        'lint_error',
        'build_failure',
        'runtime_error',
        'database',
        'git',
        'deployment',
        'other'
    )),
    
    -- Error details
    error_code TEXT,
    error_message TEXT NOT NULL,
    file_path TEXT,
    line_number INTEGER,
    
    -- Context
    trigger_action TEXT,
    environment TEXT DEFAULT 'development',
    
    -- Solution
    solution TEXT NOT NULL,
    prevention TEXT,
    
    -- Metadata
    occurrence_count INTEGER DEFAULT 1,
    last_occurred_at TIMESTAMPTZ DEFAULT NOW(),
    resolved BOOLEAN DEFAULT true,
    
    -- Searchability
    tags TEXT[]
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_dev_error_log_category ON dev_error_log(category);
CREATE INDEX IF NOT EXISTS idx_dev_error_log_file ON dev_error_log(file_path);
CREATE INDEX IF NOT EXISTS idx_dev_error_log_tags ON dev_error_log USING GIN(tags);

-- Enable RLS
ALTER TABLE dev_error_log ENABLE ROW LEVEL SECURITY;

-- Allow all authenticated users to read
CREATE POLICY "Anyone can read error log" ON dev_error_log
    FOR SELECT USING (true);

-- Only admins can insert/update/delete (using users table)
CREATE POLICY "Admins can manage error log" ON dev_error_log
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM users 
            WHERE users.id = auth.uid() 
            AND users.role = 'admin'
        )
    );

-- Auto-update timestamp trigger
CREATE OR REPLACE FUNCTION update_dev_error_log_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER dev_error_log_updated
    BEFORE UPDATE ON dev_error_log
    FOR EACH ROW
    EXECUTE FUNCTION update_dev_error_log_timestamp();

-- Insert initial error records (sanitized - no sensitive data)
INSERT INTO dev_error_log (category, error_code, error_message, file_path, trigger_action, solution, prevention, tags) VALUES
('file_edit', 'CONTENT_NOT_FOUND', 
 'Target content not found in file during edit operation.',
 'src/components/admin/AssetGenerator.tsx',
 'Attempting to replace code that had already been modified',
 'Re-read the file before each edit attempt. Use smaller, targeted edits.',
 'Always view the exact line range before editing.',
 ARRAY['edit', 'replace', 'file-content']),

('import_missing', 'TS2304',
 'Cannot find name - missing React hooks import.',
 'src/components/admin/AssetGenerator.tsx',
 'Replaced import line but removed hooks accidentally',
 'Add back the missing import statement.',
 'When modifying imports, preserve all existing imports that are still used.',
 ARRAY['react', 'hooks', 'import']),

('import_missing', 'TS2304',
 'Cannot find name - missing component import.',
 'src/components/admin/AssetGenerator.tsx',
 'Used new components in JSX without adding them to imports',
 'Add the missing component to the import statement.',
 'Before using new components, always add them to imports first.',
 ARRAY['lucide', 'icons', 'import']),

('lint_error', 'TS6133',
 'Variable is declared but its value is never read.',
 'src/components/admin/AssetGenerator.tsx',
 'Removed UI that displayed state but left the state declaration',
 'Either remove the unused state or add it back to the UI.',
 'When removing UI elements, also clean up associated state and handlers.',
 ARRAY['lint', 'unused', 'state']),

('type_mismatch', 'TS2741',
 'Property is missing in type but required in interface.',
 'src/constants/furnitureCatalog.ts',
 'Added new catalog items without the required property',
 'Make the property optional in the interface with ?',
 'Check type definitions before adding new data.',
 ARRAY['typescript', 'interface', 'type']),

('lint_error', 'TS6133',
 'Import is declared but its value is never read.',
 'src/components/admin/AdminLayout.tsx',
 'Imported component but never used it',
 'Remove unused import from the import statement.',
 'Only import what you actually use.',
 ARRAY['lint', 'unused', 'import']),

('file_edit', 'ENOENT',
 'Directory does not exist.',
 'src/constants/furnitureCatalog.ts',
 'Referenced a folder that had not been created yet',
 'Create the folder with mkdir -p before referencing it.',
 'Ensure directories exist before referencing them in code.',
 ARRAY['folder', 'path', 'mkdir']);

-- Create view for quick access
CREATE OR REPLACE VIEW common_errors AS
SELECT 
    category,
    error_message,
    solution,
    prevention,
    occurrence_count,
    tags
FROM dev_error_log
ORDER BY occurrence_count DESC, last_occurred_at DESC;

COMMENT ON TABLE dev_error_log IS 'Knowledge base of development errors and solutions for reference';
